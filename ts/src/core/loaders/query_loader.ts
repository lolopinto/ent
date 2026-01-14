import DataLoader from "dataloader";
import memoizee from "memoizee";
import {
  Context,
  Data,
  EdgeQueryableDataOptions,
  Loader,
  LoaderFactory,
  PrimableLoader,
} from "../base";
import * as clause from "../clause";
import {
  buildGroupQuery,
  getDefaultLimit,
  loadRows,
  performRawQuery,
} from "../ent";
import { OrderBy } from "../query_impl";
import { stableStringify } from "../cache_utils";
import {
  createLoaderCacheMap,
  InstrumentedDataLoader,
  getCustomLoader,
  getLoader,
  getLoaderMaxBatchSize,
} from "./loader";
import { ObjectLoaderFactory } from "./object_loader";

function getOrderByLocal(
  options: QueryOptions,
  queryOptions?: EdgeQueryableDataOptions,
): OrderBy {
  return (
    options.orderby ??
    queryOptions?.orderby ?? [
      {
        column: "created_at",
        direction: "DESC",
      },
    ]
  );
}

async function simpleCase<K extends any>(
  options: QueryOptions,
  id: K,
  queryOptions?: EdgeQueryableDataOptions,
) {
  let cls: clause.Clause;
  if (options.groupCol) {
    cls = clause.Eq(options.groupCol, id);
    if (options.clause) {
      cls = clause.And(cls, options.clause);
    }
  } else if (options.clause) {
    cls = options.clause;
  } else {
    throw new Error(`need options.groupCol or options.clause`);
  }
  if (queryOptions?.clause) {
    // TODO does this one need a getCombinedClause check??
    cls = clause.And(cls, queryOptions.clause);
  }

  return loadRows({
    ...options,
    clause: cls,
    orderby: getOrderByLocal(options, queryOptions),
    limit: queryOptions?.limit || getDefaultLimit(),
  });
}

function createLoader<K extends any>(
  options: QueryOptions,
  queryOptions?: EdgeQueryableDataOptions,
): DataLoader<K, Data[]> {
  const loaderName = options.groupCol
    ? `queryLoader:${options.tableName}:${options.groupCol}`
    : options.clause
      ? `queryLoader:${options.tableName}:${options.clause.instanceKey()}`
      : `queryLoader:${options.tableName}`;
  const loaderOptions: DataLoader.Options<K, Data[]> = {
    maxBatchSize: getLoaderMaxBatchSize(),
    cacheMap: createLoaderCacheMap(options),
  };

  return new InstrumentedDataLoader(
    loaderName,
    async (keys: K[]) => {
      if (!keys.length) {
        return [];
      }

      // keep query simple if we're only fetching for one id
      // or can't group because no groupCol...
      if (keys.length == 1 || !options.groupCol) {
        const rows = await simpleCase(options, keys[0], queryOptions);
        return [rows];
      }

      let m = new Map<K, number>();
      let result: Data[][] = [];
      for (let i = 0; i < keys.length; i++) {
        result.push([]);
        // store the index....
        m.set(keys[i], i);
      }

      const col = options.groupCol;
      let extraClause: clause.Clause | undefined;
      if (options.clause && queryOptions?.clause) {
        extraClause = clause.And(options.clause, queryOptions.clause);
      } else if (options.clause) {
        extraClause = options.clause;
      } else if (queryOptions?.clause) {
        extraClause = queryOptions.clause;
      }

      const [query, cls2] = buildGroupQuery({
        tableName: options.tableName,
        fields: options.fields,
        values: keys,
        orderby: getOrderByLocal(options, queryOptions),
        limit: queryOptions?.limit || getDefaultLimit(),
        groupColumn: col,
        clause: extraClause,
      });

      const rows = await performRawQuery(
        query,
        cls2.values(),
        cls2.logValues(),
      );
      for (const row of rows) {
        const srcID = row[col];
        const idx = m.get(srcID);
        delete row.row_num;
        if (idx === undefined) {
          throw new Error(
            `malformed query. got ${srcID} back but didn't query for it`,
          );
        }
        result[idx].push(row);
      }
      return result;
    },
    loaderOptions,
    options.tableName,
  );
}

class QueryDirectLoader<K extends any> implements Loader<K, Data[]> {
  private memoizedInitPrime: () => void;
  private primedLoaders:
    | Map<string, PrimableLoader<any, Data | null>>
    | undefined;
  constructor(
    private options: QueryOptions,
    private queryOptions?: EdgeQueryableDataOptions,
    public context?: Context,
  ) {
    this.memoizedInitPrime = memoizee(this.initPrime.bind(this));
  }

  private initPrime() {
    if (!this.context || !this.options?.toPrime) {
      return;
    }
    let primedLoaders = new Map();
    this.options.toPrime.forEach((prime) => {
      const l2 = prime.createLoader(this.context);
      if ((l2 as PrimableLoader<any, Data | null>).prime === undefined) {
        return;
      }
      primedLoaders.set(prime.options.key, l2);
    });
    this.primedLoaders = primedLoaders;
  }

  async load(id: K): Promise<Data[]> {
    const rows = await simpleCase(this.options, id, this.queryOptions);
    if (this.context) {
      this.memoizedInitPrime();
      if (this.primedLoaders) {
        for (const row of rows) {
          for (const [key, loader] of this.primedLoaders) {
            const value = row[key];
            if (value !== undefined) {
              loader.prime(row);
            }
          }
        }
      }
    }
    return rows;
  }

  clearAll() {}
}

// note, you should never call this directly
// there's scenarios where QueryDirectLoader is needed instead of this...
class QueryLoader<K extends any> implements Loader<K, Data[]> {
  private loader: DataLoader<K, Data[]> | undefined;
  private primedLoaders:
    | Map<string, PrimableLoader<any, Data | null>>
    | undefined;
  private memoizedInitPrime: () => void;
  constructor(
    private options: QueryOptions,
    public context?: Context,
    private queryOptions?: EdgeQueryableDataOptions,
  ) {
    if (context) {
      this.loader = createLoader(options, queryOptions);
    }
    this.memoizedInitPrime = memoizee(this.initPrime.bind(this));
  }

  private initPrime() {
    if (!this.context || !this.options?.toPrime) {
      return;
    }
    let primedLoaders = new Map();
    this.options.toPrime.forEach((prime) => {
      const l2 = prime.createLoader(this.context);
      if ((l2 as PrimableLoader<any, Data | null>).prime === undefined) {
        return;
      }
      primedLoaders.set(prime.options.key, l2);
    });
    this.primedLoaders = primedLoaders;
  }

  async load(id: K): Promise<Data[]> {
    if (this.loader) {
      this.memoizedInitPrime();
      const rows = await this.loader.load(id);
      if (this.primedLoaders) {
        for (const row of rows) {
          for (const [key, loader] of this.primedLoaders) {
            const value = row[key];
            if (value !== undefined) {
              loader.prime(row);
            }
          }
        }
      }
      return rows;
    }

    return simpleCase(this.options, id, this.queryOptions);
  }

  clearAll() {
    this.loader && this.loader.clearAll();
  }
}

interface QueryOptions {
  fields: (
    | string
    | {
        alias: string;
        column: string;
      }
  )[];
  tableName: string; // or function for assoc_edge. come back to it
  // if provided, we'll group queries to the database via this key and this will be the unique id we're querying for
  // using window functions or not
  groupCol?: string;
  // will be combined with groupCol to make a simple or complex query
  // if no groupCol, this is required
  // if no clause and groupCol, we'll just use groupCol to make the query
  clause?: clause.Clause;
  // order by
  orderby?: OrderBy;

  // if provided, will be used to prime data in this object...
  toPrime?: ObjectLoaderFactory<Data>[];
}

export class QueryLoaderFactory<K extends any>
  implements LoaderFactory<K, Data[]>
{
  name: string;
  constructor(private options: QueryOptions) {
    if (options.groupCol) {
      this.name = `queryLoader:${options.tableName}:${options.groupCol}`;
    } else if (options.clause) {
      this.name = `queryLoader:${
        options.tableName
      }:${options.clause.instanceKey()}`;
    } else {
      throw new Error(
        `must pass at least one of groupCol and clause to QueryLoaderFactory`,
      );
    }
  }

  createLoader(context?: Context) {
    return getLoader(
      this,
      () => new QueryLoader(this.options, context),
      context,
    );
  }

  createConfigurableLoader(
    options: EdgeQueryableDataOptions,
    context?: Context,
  ) {
    return QueryLoaderFactory.createConfigurableLoader(
      this.name,
      this.options,
      options,
      context,
    );
  }

  static createConfigurableLoader(
    name: string,
    queryOptions: QueryOptions,
    options: EdgeQueryableDataOptions,
    context?: Context,
  ) {
    if (!context) {
      return new QueryDirectLoader(queryOptions, options, context);
    }

    if (options.clause) {
      const effectiveOrderBy = getOrderByLocal(queryOptions, options);
      const effectiveLimit = options.limit || getDefaultLimit();
      const disableTransformations = options.disableTransformations ?? false;
      const keyParts = [
        name,
        `clause:${options.clause.instanceKey()}`,
        queryOptions.clause
          ? `baseClause:${queryOptions.clause.instanceKey()}`
          : undefined,
        `limit:${effectiveLimit}`,
        `orderby:${stableStringify(effectiveOrderBy)}`,
        `disableTransformations:${disableTransformations}`,
      ];
      const key = keyParts
        .filter((part): part is string => Boolean(part))
        .join(":");
      return getCustomLoader(
        key,
        () => new QueryDirectLoader(queryOptions, options, context),
        context,
      );
    }

    const effectiveOrderBy = getOrderByLocal(queryOptions, options);
    const effectiveLimit = options.limit || getDefaultLimit();
    const disableTransformations = options.disableTransformations ?? false;
    const key = `${name}:limit:${effectiveLimit}:orderby:${stableStringify(
      effectiveOrderBy,
    )}:disableTransformations:${disableTransformations}`;
    return getCustomLoader(
      key,
      () => new QueryLoader(queryOptions, context, options),
      context,
    );
  }
}
