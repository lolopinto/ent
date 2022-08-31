import DataLoader from "dataloader";
import {
  LoadRowOptions,
  ID,
  Data,
  SelectDataOptions,
  Context,
  Loader,
  LoaderFactory,
  PrimableLoader,
} from "../base";
import { loadRow, loadRows } from "../ent";
import * as clause from "../clause";
import { logEnabled } from "../logger";

import { getLoader, cacheMap } from "./loader";
import memoizee from "memoizee";

async function loadRowsForLoader<T>(
  options: SelectDataOptions,
  ids: T[],
  context?: Context,
) {
  let col = options.key;
  let cls = clause.In(col, ...ids);
  if (options.clause) {
    let optionClause: clause.Clause | undefined;
    if (typeof options.clause === "function") {
      optionClause = options.clause();
    } else {
      optionClause = options.clause;
    }
    if (optionClause) {
      cls = clause.And(cls, optionClause);
    }
  }
  const rowOptions: LoadRowOptions = {
    ...options,
    clause: cls,
    context,
  };

  let m = new Map<T, number>();
  let result: (Data | null)[] = [];
  for (let i = 0; i < ids.length; i++) {
    result.push(null);
    // store the index....
    m.set(ids[i], i);
  }

  const rows = await loadRows(rowOptions);
  for (const row of rows) {
    const id = row[col];
    if (id === undefined) {
      throw new Error(
        `need to query for column ${col} when using an object loader because the query may not be sorted and we need the id to maintain sort order`,
      );
    }
    const idx = m.get(id);
    if (idx === undefined) {
      throw new Error(
        `malformed query. got ${id} back but didn't query for it`,
      );
    }
    result[idx] = row;
  }
  return result;
}

// optional clause...
// so ObjectLoaderFactory and createDataLoader need to take a new optional field which is a clause that's always added here
// and we need a disableTransform which skips loader completely and uses loadRow...
function createDataLoader(options: SelectDataOptions) {
  const loaderOptions: DataLoader.Options<any, any> = {};

  // if query logging is enabled, we should log what's happening with loader
  if (logEnabled("query")) {
    loaderOptions.cacheMap = new cacheMap(options);
  }

  return new DataLoader(async (ids: ID[]) => {
    if (!ids.length) {
      return [];
    }

    // context not needed because we're creating a loader which has its own cache which is being used here
    return loadRowsForLoader(options, ids);
  }, loaderOptions);
}

export class ObjectLoader<T> implements Loader<T, Data | null> {
  private loader: DataLoader<T, Data> | undefined;
  private primedLoaders:
    | Map<string, PrimableLoader<T, Data | null>>
    | undefined;
  private memoizedInitPrime: () => void;

  constructor(
    private options: SelectDataOptions,
    public context?: Context,
    private toPrime?: ObjectLoaderFactory<T>[],
  ) {
    if (options.key === undefined) {
      console.trace();
    }
    if (context) {
      this.loader = createDataLoader(options);
    }
    this.memoizedInitPrime = memoizee(this.initPrime.bind(this));
  }

  getOptions(): SelectDataOptions {
    return this.options;
  }

  private initPrime() {
    if (!this.context || !this.toPrime) {
      return;
    }
    let primedLoaders = new Map();
    this.toPrime.forEach((prime) => {
      const l2 = prime.createLoader(this.context);
      if ((l2 as PrimableLoader<T, Data | null>).prime === undefined) {
        return;
      }

      primedLoaders.set(prime.options.key, l2);
    });
    this.primedLoaders = primedLoaders;
  }

  async load(key: T): Promise<Data | null> {
    // simple case. we get parallelization etc
    if (this.loader) {
      this.memoizedInitPrime();
      // prime the result if we got primable loaders
      const result = await this.loader.load(key);
      if (result && this.primedLoaders) {
        for (const [key, loader] of this.primedLoaders) {
          const value = result[key];
          if (value !== undefined) {
            loader.prime(result);
          }
        }
      }

      return result;
    }

    let cls: clause.Clause = clause.Eq(this.options.key, key);
    if (this.options.clause) {
      let optionClause: clause.Clause | undefined;
      if (typeof this.options.clause === "function") {
        optionClause = this.options.clause();
      } else {
        optionClause = this.options.clause;
      }
      if (optionClause) {
        cls = clause.And(cls, optionClause);
      }
    }
    const rowOptions: LoadRowOptions = {
      ...this.options,
      clause: cls,
      context: this.context,
    };
    return loadRow(rowOptions);
  }

  clearAll() {
    this.loader && this.loader.clearAll();
  }

  async loadMany(keys: T[]): Promise<Array<Data | null>> {
    if (this.loader) {
      return await this.loader.loadMany(keys);
    }

    return loadRowsForLoader(this.options, keys, this.context);
  }

  prime(data: Data) {
    // we have this data from somewhere else, prime it in the c
    if (this.loader) {
      const col = this.options.key;
      const key = data[col];
      this.loader.prime(key, data);
    }
  }

  // prime this loader and any other loaders it's aware of
  primeAll(data: Data) {
    this.prime(data);
    if (this.primedLoaders) {
      for (const [key, loader] of this.primedLoaders) {
        const value = data[key];
        if (value !== undefined) {
          loader.prime(data);
        }
      }
    }
  }
}

interface ObjectLoaderOptions extends SelectDataOptions {
  // needed when clause is a function...
  instanceKey?: string;
}

// NOTE: if not querying for all columns
// have to query for the id field as one of the fields
// because it's used to maintain sort order of the queried ids
export class ObjectLoaderFactory<T> implements LoaderFactory<T, Data | null> {
  name: string;
  private toPrime: ObjectLoaderFactory<T>[] = [];

  constructor(public options: ObjectLoaderOptions) {
    let instanceKey = options.instanceKey || "";
    if (typeof this.options.clause === "function") {
      if (!options.instanceKey) {
        throw new Error(
          `need to pass an instanceKey to ObjectLoader if clause is a function`,
        );
      }
    } else if (this.options.clause) {
      instanceKey = this.options.clause.instanceKey();
    }
    this.name = `${options.tableName}:${options.key}:${instanceKey}`;
  }

  createLoader(context?: Context): ObjectLoader<T> {
    return getLoader(
      this,
      () => {
        return new ObjectLoader(this.options, context, this.toPrime);
      },
      context,
    ) as ObjectLoader<T>;
  }

  // keep track of loaders to prime. needs to be done not in the constructor
  // because there's usually self references here
  addToPrime(factory: ObjectLoaderFactory<T>): this {
    this.toPrime.push(factory);
    return this;
  }
}
