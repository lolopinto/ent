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
    let col = options.key;
    const rowOptions: LoadRowOptions = {
      ...options,
      clause: clause.In(col, ...ids),
    };

    let m = new Map<ID, number>();
    let result: (Data | null)[] = [];
    for (let i = 0; i < ids.length; i++) {
      result.push(null);
      // store the index....
      m.set(ids[i], i);
    }

    // context not needed because we're creating a loader which has its own cache which is being used here
    const rows = await loadRows(rowOptions);
    for (const row of rows) {
      const id = row[col];
      const idx = m.get(id);
      if (idx === undefined) {
        throw new Error(
          `malformed query. got ${id} back but didn't query for it`,
        );
      }
      result[idx] = row;
    }

    return result;
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

    const rowOptions: LoadRowOptions = {
      ...this.options,
      clause: clause.Eq(this.options.key, key),
      context: this.context,
    };
    return await loadRow(rowOptions);
  }

  clearAll() {
    this.loader && this.loader.clearAll();
  }

  async loadMany(keys: T[]): Promise<Data[]> {
    if (this.loader) {
      return await this.loader.loadMany(keys);
    }

    const rowOptions: LoadRowOptions = {
      ...this.options,
      clause: clause.In(this.options.key, ...keys),
      context: this.context,
    };
    return await loadRows(rowOptions);
  }

  prime(data: Data) {
    // we have this data from somewhere else, prime it in the c
    if (this.loader) {
      const col = this.options.key;
      const key = data[col];
      this.loader.prime(key, data);
    }
  }
}

export class ObjectLoaderFactory<T> implements LoaderFactory<T, Data | null> {
  name: string;
  private toPrime: ObjectLoaderFactory<T>[] = [];

  constructor(public options: SelectDataOptions) {
    this.name = `${options.tableName}:${options.key}`;
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
  addToPrime(factory: ObjectLoaderFactory<T>) {
    this.toPrime.push(factory);
  }
}
