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
  DataOptions,
} from "../base";
import { loadRow, loadRows } from "../ent";
import * as clause from "../clause";
import { log, logEnabled } from "../logger";
import { getCombinedClause } from "../clause";

import { getLoader, CacheMap, getCustomLoader } from "./loader";
import memoizee from "memoizee";

const DEFAULT_CLAUSE_LOADER_CONCURRENCY = 10;
let clauseLoaderConcurrency = DEFAULT_CLAUSE_LOADER_CONCURRENCY;

export function setClauseLoaderConcurrency(limit: number) {
  if (!Number.isFinite(limit) || limit < 1) {
    clauseLoaderConcurrency = DEFAULT_CLAUSE_LOADER_CONCURRENCY;
    return;
  }
  clauseLoaderConcurrency = Math.floor(limit);
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!items.length) {
    return [];
  }
  const results = new Array<R>(items.length);
  const workerCount = Math.min(items.length, Math.max(1, limit));
  let nextIndex = 0;

  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        return;
      }
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
}

async function loadRowsForIDLoader<K, V = Data>(
  options: SelectDataOptions,
  ids: K[],
  context?: Context,
) {
  let col = options.key;
  const cls = getCombinedClause(
    options,
    clause.DBTypeIn(col, ids, options.keyType || "uuid"),
  );

  const rowOptions: LoadRowOptions = {
    ...options,
    clause: cls,
    context,
  };

  let m = new Map<K, number>();
  let result: (V | null)[] = [];
  for (let i = 0; i < ids.length; i++) {
    result.push(null);
    // store the index....
    m.set(ids[i], i);
  }

  const rows = (await loadRows(rowOptions)) as V[];
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

async function loadRowsForClauseLoader<
  TQueryData extends Data = Data,
  TResultData extends Data = TQueryData,
  K = keyof TQueryData,
>(
  options: SelectDataOptions,
  clause: clause.Clause<TQueryData, K>,
): Promise<TResultData[]> {
  const rowOptions: LoadRowOptions = {
    ...options,
    // @ts-expect-error clause in LoadRowOptions doesn't take templatized version of Clause
    clause: getCombinedClause(options, clause, true),
  };

  return (await loadRows(rowOptions)) as TResultData[];
}

async function loadCountForClauseLoader<V extends Data = Data, K = keyof V>(
  options: SelectDataOptions,
  clause: clause.Clause<V, K>,
): Promise<number> {
  const rowOptions: LoadRowOptions = {
    ...options,
    // @ts-expect-error clause in LoadRowOptions doesn't take templatized version of Clause
    clause: getCombinedClause(options, clause, true),
  };

  const row = await loadRow({
    ...rowOptions,
    fields: ["count(*) as count"],
  });
  if (!row) {
    return 0;
  }
  return parseInt(row.count, 10);
}

// optional clause...
// so ObjectLoaderFactory and createDataLoader need to take a new optional field which is a clause that's always added here
// and we need a disableTransform which skips loader completely and uses loadRow...
function createDataLoader(options: SelectDataOptions) {
  const loaderOptions: DataLoader.Options<any, any> = {};

  // if query logging is enabled, we should log what's happening with loader
  if (logEnabled("query")) {
    loaderOptions.cacheMap = new CacheMap(options);
  }

  return new DataLoader(async (ids: ID[]) => {
    if (!ids.length) {
      return [];
    }

    // context not needed because we're creating a loader which has its own cache which is being used here
    return loadRowsForIDLoader(options, ids);
  }, loaderOptions);
}

class clauseCacheMap {
  private m = new Map();

  constructor(
    private options: DataOptions,
    private count?: boolean,
  ) {}

  get(key: clause.Clause) {
    const key2 = key.instanceKey();
    const ret = this.m.get(key2);
    if (ret) {
      log("cache", {
        "dataloader-cache-hit": key2 + (this.count ? ":count" : ""),
        "tableName": this.options.tableName,
      });
    }
    return ret;
  }

  set(key: clause.Clause, value: any) {
    return this.m.set(key.instanceKey(), value);
  }

  delete(key: clause.Clause) {
    return this.m.delete(key.instanceKey());
  }

  clear() {
    return this.m.clear();
  }
}

function createClauseDataLoder<
  TQueryData extends Data = Data,
  TResultData extends Data = TQueryData,
  K = keyof TQueryData,
>(options: SelectDataOptions) {
  return new DataLoader(
    async (clauses: clause.Clause<TQueryData, K>[]) => {
      if (!clauses.length) {
        return [];
      }
      return mapWithConcurrency(
        clauses,
        clauseLoaderConcurrency,
        (clauseItem) =>
          loadRowsForClauseLoader<TQueryData, TResultData, K>(
            options,
            clauseItem,
          ),
      );
    },
    {
      cacheMap: new clauseCacheMap(options),
    },
  );
}

function createClauseCountDataLoader<V extends Data = Data, K = keyof V>(
  options: SelectDataOptions,
) {
  return new DataLoader(
    async (clauses: clause.Clause<V, K>[]) => {
      if (!clauses.length) {
        return [];
      }
      return mapWithConcurrency(clauses, clauseLoaderConcurrency, (clauseItem) =>
        loadCountForClauseLoader(options, clauseItem),
      );
    },
    {
      cacheMap: new clauseCacheMap(options, true),
    },
  );
}

export class ObjectLoader<
    TQueryData extends Data = Data,
    TResultData extends Data = TQueryData,
    K = keyof TQueryData,
  >
  implements
    Loader<ID, TResultData | null>,
    Loader<clause.Clause<TQueryData, K>, TResultData[] | null>
{
  private idLoader: DataLoader<ID, TResultData> | undefined;
  private clauseLoader: DataLoader<
    clause.Clause<TQueryData, K>,
    TResultData[]
  > | null;

  private primedLoaders:
    | Map<string, PrimableLoader<ID, TResultData | null>>
    | undefined;
  private memoizedInitPrime: () => void;

  constructor(
    private options: SelectDataOptions,
    public context?: Context,
    private toPrime?: ObjectLoaderFactory<TResultData>[],
  ) {
    if (options.key === undefined) {
      console.trace();
    }
    if (context) {
      this.idLoader = createDataLoader(options);
      this.clauseLoader = createClauseDataLoder(options);
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
      if ((l2 as PrimableLoader<ID, TResultData | null>).prime === undefined) {
        return;
      }

      primedLoaders.set(prime.options.key, l2);
    });
    this.primedLoaders = primedLoaders;
  }

  async load(key: ID): Promise<TResultData | null>;
  async load(key: clause.Clause<TQueryData, K>): Promise<TResultData[] | null>;
  async load(
    key: clause.Clause<TQueryData, K> | ID,
  ): Promise<TResultData | TResultData[] | null> {
    if (typeof key === "string" || typeof key === "number") {
      return this.loadID(key);
    }

    return this.loadClause(key);
  }

  private async loadID(key: ID): Promise<TResultData | null> {
    // simple case. we get parallelization etc
    if (this.idLoader) {
      this.memoizedInitPrime();
      // prime the result if we got primable loaders
      const result = await this.idLoader.load(key);
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

    const cls = getCombinedClause(
      this.options,
      clause.Eq(this.options.key, key),
    );
    const rowOptions: LoadRowOptions = {
      ...this.options,
      clause: cls,
      context: this.context,
    };
    return loadRow(rowOptions) as Promise<TResultData | null>;
  }

  private async loadClause(
    key: clause.Clause<TQueryData, K>,
  ): Promise<TResultData[] | null> {
    if (this.clauseLoader) {
      return this.clauseLoader.load(key);
    }
    return loadRowsForClauseLoader(this.options, key);
  }

  clearAll() {
    this.idLoader && this.idLoader.clearAll();
    this.clauseLoader && this.clauseLoader.clearAll();
  }
  async loadMany(keys: ID[]): Promise<Array<TResultData | null>>;
  async loadMany(
    keys: clause.Clause<TQueryData, K>[],
  ): Promise<Array<TResultData[] | null>>;
  async loadMany(
    keys: ID[] | clause.Clause<TQueryData, K>[],
  ): Promise<Array<TResultData | TResultData[] | null>> {
    if (!keys.length) {
      return [];
    }

    if (typeof keys[0] === "string" || typeof keys[0] === "number") {
      return this.loadIDMany(keys as ID[]);
    }

    return this.loadClauseMany(keys as clause.Clause<TQueryData, K>[]);
  }

  private loadIDMany(keys: ID[]): Promise<Array<TResultData | null>> {
    if (this.idLoader) {
      // @ts-expect-error TODO?
      return this.idLoader.loadMany(keys);
    }

    return loadRowsForIDLoader(this.options, keys, this.context);
  }

  private async loadClauseMany(
    keys: clause.Clause<TQueryData, K>[],
  ): Promise<Array<TResultData[] | null>> {
    if (this.clauseLoader) {
      // @ts-expect-error TODO?
      return this.clauseLoader.loadMany(keys);
    }

    return mapWithConcurrency(keys, clauseLoaderConcurrency, (key) =>
      loadRowsForClauseLoader<TQueryData, TResultData, K>(this.options, key),
    );
  }

  prime(data: TResultData) {
    // we have this data from somewhere else, prime it in the c
    if (this.idLoader) {
      const col = this.options.key;
      const key = data[col];
      this.idLoader.prime(key, data);
    }
  }

  // prime this loader and any other loaders it's aware of
  primeAll(data: TResultData) {
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

export class ObjectCountLoader<V extends Data = Data, K = keyof V>
  implements Loader<clause.Clause<V, K>, number>
{
  private loader: DataLoader<clause.Clause<V, K>, number> | null;

  constructor(
    private options: SelectDataOptions,
    public context?: Context,
  ) {
    if (context) {
      this.loader = createClauseCountDataLoader(options);
    }
  }

  getOptions(): SelectDataOptions {
    return this.options;
  }

  async load(key: clause.Clause<V, K>): Promise<number> {
    if (this.loader) {
      return this.loader.load(key);
    }
    return loadCountForClauseLoader(this.options, key);
  }

  clearAll() {
    this.loader && this.loader.clearAll();
  }

  async loadMany(keys: clause.Clause<V, K>[]): Promise<Array<number>> {
    if (!keys.length) {
      return [];
    }
    if (this.loader) {
      // @ts-expect-error
      return this.loader.loadMany(keys);
    }

    return mapWithConcurrency(keys, clauseLoaderConcurrency, (key) =>
      loadCountForClauseLoader(this.options, key),
    );
  }
}

interface ObjectLoaderOptions extends SelectDataOptions {
  // needed when clause is a function...
  instanceKey?: string;
}

// NOTE: if not querying for all columns
// have to query for the id field as one of the fields
// because it's used to maintain sort order of the queried ids
export class ObjectLoaderFactory<V extends Data = Data>
  implements
    LoaderFactory<ID, V | null>,
    LoaderFactory<clause.Clause<V>, V[] | null>
{
  name: string;
  private toPrime: ObjectLoaderFactory<V>[] = [];

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

  createLoader(context?: Context): ObjectLoader<V> {
    return getLoader(
      this,
      () => {
        return new ObjectLoader(this.options, context, this.toPrime);
      },
      context,
    ) as ObjectLoader<V>;
  }

  createTypedLoader<
    TQueryData extends Data = Data,
    TResultData extends Data = Data,
    K = keyof TQueryData,
  >(context?: Context): ObjectLoader<TQueryData, TResultData, K> {
    const loader = this.createLoader(context);
    return loader as unknown as ObjectLoader<TQueryData, TResultData, K>;
  }

  createCountLoader<K = keyof V>(context?: Context): ObjectCountLoader<V, K> {
    return getCustomLoader(
      `${this.name}:count_loader`,
      () => {
        return new ObjectCountLoader(this.options, context);
      },
      context,
    ) as ObjectCountLoader<V, K>;
  }

  // keep track of loaders to prime. needs to be done not in the constructor
  // because there's usually self references here
  addToPrime(factory: ObjectLoaderFactory<V>): this {
    this.toPrime.push(factory);
    return this;
  }
}
