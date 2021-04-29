import DataLoader from "dataloader";
import {
  ID,
  SelectDataOptions,
  Context,
  Data,
  Loader,
  LoaderFactory,
  EdgeQueryableDataOptions,
  QueryableDataOptions,
} from "../base";
import {
  performRawQuery,
  buildGroupQuery,
  loadRows,
  DefaultLimit,
} from "../ent";
import * as clause from "../clause";
import { logEnabled } from "../logger";
import { cacheMap, getCustomLoader, getLoader } from "./loader";

async function simpleCase(
  options: SelectDataOptions,
  col: string,
  id: ID,
  opts?: {
    queryOptions?: EdgeQueryableDataOptions;
    extraClause?: clause.Clause;
    sortColumn?: string;
  },
) {
  let cls: clause.Clause = clause.Eq(col, id);
  if (opts?.extraClause) {
    cls = clause.And(cls, opts.extraClause);
  }
  if (opts?.queryOptions?.clause) {
    cls = clause.And(cls, opts.queryOptions.clause);
  }
  let sortCol = opts?.sortColumn || "created_at";
  let orderby = opts?.queryOptions?.orderby || `${sortCol} DESC`;

  return await loadRows({
    ...options,
    fields: options.fields,
    clause: cls,
    orderby: orderby,
    limit: opts?.queryOptions?.limit || DefaultLimit,
  });
}

function createLoader(
  options: SelectDataOptions,
  col: string,
  extraClause?: clause.Clause,
  sortColumn?: string,
  queryOptions?: EdgeQueryableDataOptions,
): DataLoader<ID, Data[]> {
  if (!sortColumn) {
    sortColumn = "created_at";
  }

  const loaderOptions: DataLoader.Options<ID, Data[]> = {};

  // if query logging is enabled, we should log what's happening with loader
  if (logEnabled("query")) {
    loaderOptions.cacheMap = new cacheMap(options);
  }

  return new DataLoader(async (keys: ID[]) => {
    if (!keys.length) {
      return [];
    }

    // keep query simple if we're only fetching for one id
    if (keys.length == 1) {
      const rows = await simpleCase(options, col, keys[0], {
        sortColumn,
        extraClause,
        queryOptions,
      });
      return [rows];
    }

    let cls: clause.Clause = clause.In(col, ...keys);
    if (extraClause) {
      cls = clause.And(cls, extraClause);
    }

    let m = new Map<ID, number>();
    let result: Data[][] = [];
    for (let i = 0; i < keys.length; i++) {
      result.push([]);
      // store the index....
      m.set(keys[i], i);
    }

    const [query, cls2] = buildGroupQuery({
      tableName: options.tableName,
      fields: options.fields,
      values: keys,
      orderby: queryOptions?.orderby || `${sortColumn} DESC`,
      limit: queryOptions?.limit || DefaultLimit,
      fkeyColumn: col,
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

export class IndexDirectLoader implements Loader<ID, Data[]> {
  constructor(
    private options: SelectDataOptions,
    private col: string,
    private opts: {
      queryOptions: EdgeQueryableDataOptions;
      extraClause?: clause.Clause;
      sortColumn?: string;
    },
  ) {}

  async load(id: ID): Promise<Data[]> {
    return simpleCase(this.options, this.col, id, this.opts);
  }
}

// for now this only works for single column counts
// e.g. foreign key count
export class IndexLoader implements Loader<ID, Data[]> {
  private loader: DataLoader<ID, Data[]> | undefined;
  // tableName, columns
  constructor(
    private options: SelectDataOptions,
    private col: string,
    public context?: Context,
    private opts?: {
      extraClause?: clause.Clause;
      sortColumn?: string;
      queryOptions?: EdgeQueryableDataOptions;
    },
  ) {
    if (context) {
      this.loader = createLoader(
        options,
        this.col,
        opts?.extraClause,
        opts?.sortColumn,
        opts?.queryOptions,
      );
    }
  }

  async load(id: ID): Promise<Data[]> {
    if (this.loader) {
      return await this.loader.load(id);
    }

    return simpleCase(this.options, this.col, id, this.opts);
  }
}

export class IndexLoaderFactory implements LoaderFactory<ID, Data[]> {
  name: string;
  constructor(
    private options: SelectDataOptions,
    private col: string,
    private opts?: {
      extraClause?: clause.Clause;
      sortColumn?: string;
    },
  ) {
    this.name = `indexLoader:${options.tableName}:${this.col}`;
  }

  createLoader(context?: Context) {
    return getLoader(
      this,
      () => new IndexLoader(this.options, this.col, context, this.opts),
      context,
    );
  }

  createConfigurableLoader(
    options: EdgeQueryableDataOptions,
    context?: Context,
  ) {
    if (options?.clause || !context) {
      return new IndexDirectLoader(this.options, this.col, {
        ...this.opts,
        queryOptions: options,
      });
    }

    // we create a loader which can combine first X queries in the same fetch
    const key = `${this.name}:limit:${options.limit}:orderby:${options.orderby}`;
    return getCustomLoader(
      key,
      () =>
        new IndexLoader(this.options, this.col, context, {
          ...this.opts,
          queryOptions: options,
        }),
      context,
    );
  }
}
