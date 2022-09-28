import DataLoader from "dataloader";
import {
  Context,
  ID,
  EdgeQueryableDataOptions,
  Loader,
  LoaderFactory,
  Data,
  PrimableLoader,
} from "../base";
import {
  DefaultLimit,
  performRawQuery,
  buildGroupQuery,
  loadRows,
} from "../ent";
import * as clause from "../clause";
import { logEnabled } from "../logger";
import { cacheMap, getCustomLoader, getLoader } from "./loader";
import memoizee from "memoizee";
import { ObjectLoaderFactory } from "./object_loader";

export function getOrderBy(sortCol: string, orderby?: string) {
  if (orderby) {
    return orderby;
  }
  let sortColLower = sortCol.toLowerCase();
  let orderbyDirection = " DESC";
  if (sortColLower.endsWith("asc") || sortCol.endsWith("desc")) {
    orderbyDirection = "";
  }
  return `${sortCol}${orderbyDirection}`;
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
    cls = clause.And(cls, queryOptions.clause);
  }

  let sortCol = options.sortColumn || "created_at";

  return await loadRows({
    ...options,
    clause: cls,
    orderby: getOrderBy(sortCol, queryOptions?.orderby),
    limit: queryOptions?.limit || DefaultLimit,
  });
}

function createLoader<K extends any>(
  options: QueryOptions,
  queryOptions?: EdgeQueryableDataOptions,
): DataLoader<K, Data[]> {
  let sortCol = options.sortColumn || "created_at";

  const loaderOptions: DataLoader.Options<K, Data[]> = {};

  // if query logging is enabled, we should log what's happening with loader
  if (logEnabled("query")) {
    loaderOptions.cacheMap = new cacheMap(options);
  }

  return new DataLoader(async (keys: K[]) => {
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
      orderby: getOrderBy(sortCol, queryOptions?.orderby),
      limit: queryOptions?.limit || DefaultLimit,
      groupColumn: col,
      clause: extraClause,
    });

    const rows = await performRawQuery(query, cls2.values(), cls2.logValues());
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
  }, loaderOptions);
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
  fields: string[];
  tableName: string; // or function for assoc_edge. come back to it
  // if provided, we'll group queries to the database via this key and this will be the unique id we're querying for
  // using window functions or not
  groupCol?: string;
  // will be combined with groupCol to make a simple or complex query
  // if no groupCol, this is required
  // if no clause and groupCol, we'll just use groupCol to make the query
  clause?: clause.Clause;
  sortColumn?: string; // order by this column

  // if provided, will be used to prime data in this object...
  toPrime?: ObjectLoaderFactory<ID>[];
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
    if (options.clause || !context) {
      return new QueryDirectLoader(queryOptions, options, context);
    }

    const key = `${name}:limit:${options.limit}:orderby:${options.orderby}`;
    return getCustomLoader(
      key,
      () => new QueryLoader(queryOptions, context, options),
      context,
    );
  }
}
