import DB, {
  Dialect,
  Queryer,
  SyncQueryer,
  QueryResult,
  QueryResultRow,
} from "./db";
import {
  Viewer,
  Ent,
  ID,
  LoadRowsOptions,
  LoadRowOptions,
  Data,
  DataOptions,
  QueryableDataOptions,
  EditRowOptions,
  LoadEntOptions,
  LoadCustomEntOptions,
  EdgeQueryableDataOptions,
  Context,
  SelectDataOptions,
  CreateRowOptions,
  QueryDataOptions,
  EntConstructor,
  PrivacyPolicy,
  SelectCustomDataOptions,
  PrimableLoader,
  Loader,
  LoaderWithLoadMany,
} from "./base";

import { applyPrivacyPolicy, applyPrivacyPolicyImpl } from "./privacy";

import * as clause from "./clause";
import { log, logEnabled, logTrace } from "./logger";
import DataLoader from "dataloader";
import { __getGlobalSchema } from "./global_schema";
import { OrderBy, buildQuery, getOrderByPhrase } from "./query_impl";
import { CacheMap } from "./loaders/loader";

class entCacheMap<TViewer extends Viewer, TEnt extends Ent<TViewer>> {
  private m = new Map();
  private logEnabled = false;
  constructor(
    private viewer: TViewer,
    private options: LoadEntOptions<TEnt, TViewer>,
  ) {
    this.logEnabled = logEnabled("cache");
  }

  get(id: ID) {
    const ret = this.m.get(id);
    if (this.logEnabled && ret) {
      const key = getEntKey(this.viewer, id, this.options);
      log("cache", {
        "ent-cache-hit": key,
      });
    }
    return ret;
  }

  set(key: string, value: any) {
    return this.m.set(key, value);
  }

  delete(key: string) {
    return this.m.delete(key);
  }

  clear() {
    return this.m.clear();
  }
}

function createAssocEdgeConfigLoader(options: SelectDataOptions) {
  const loaderOptions: DataLoader.Options<ID, Data | null> = {};

  // if query logging is enabled, we should log what's happening with loader
  if (logEnabled("query")) {
    loaderOptions.cacheMap = new CacheMap(options);
  }

  // something here brokwn with strict:true
  return new DataLoader<ID, Data | null>(async (ids: ID[]) => {
    if (!ids.length) {
      return [];
    }
    let col = options.key;
    // defaults to uuid
    let typ = options.keyType || "uuid";

    const rowOptions: LoadRowOptions = {
      ...options,
      clause: clause.DBTypeIn(col, ids, typ),
    };

    // TODO is there a better way of doing this?
    // context not needed because we're creating a loader which has its own cache which is being used here
    const nodes = await loadRows(rowOptions);
    let result: (Data | null)[] = ids.map((id) => {
      for (const node of nodes) {
        if (node[col] === id) {
          return node;
        }
      }
      return null;
    });

    return result;
  }, loaderOptions);
}

// used to wrap errors that would eventually be thrown in ents
// not an Error because DataLoader automatically rejects that
class ErrorWrapper {
  constructor(public error: Error) {}
}

// note if storing the result of this in something that checks instanceof Error e.g. DataLoader, we need to check instanceof at that callsite
export function rowIsError(row: any): row is Error {
  // jest does things that break instanceof checks
  // so we need to check the name as well for native error SqliteError
  return row instanceof Error || row?.constructor?.name === "SqliteError";
}

function createEntLoader<TEnt extends Ent<TViewer>, TViewer extends Viewer>(
  viewer: Viewer,
  options: LoadEntOptions<TEnt, TViewer>,
  map: entCacheMap<TViewer, TEnt>,
): DataLoader<ID, TEnt | ErrorWrapper> {
  // share the cache across loaders even if we create a new instance
  const loaderOptions: DataLoader.Options<any, any> = {};
  loaderOptions.cacheMap = map;

  return new DataLoader(async (ids: ID[]) => {
    if (!ids.length) {
      return [];
    }

    let result: (TEnt | ErrorWrapper | Error)[] = [];

    const tableName = options.loaderFactory.options?.tableName;
    const loader = options.loaderFactory.createLoader(viewer.context);
    const rows = await loader.loadMany(ids);
    // this is a loader which should return the same order based on passed-in ids
    // so let's depend on that...

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];

      // db error
      if (rowIsError(row)) {
        if (row instanceof Error) {
          result[idx] = row;
        } else {
          // @ts-ignore SqliteError
          result[idx] = new Error(row.message);
        }
        continue;
      } else if (!row) {
        if (tableName) {
          result[idx] = new ErrorWrapper(
            new Error(
              `couldn't find row for value ${ids[idx]} in table ${tableName}`,
            ),
          );
        } else {
          result[idx] = new ErrorWrapper(
            new Error(`couldn't find row for value ${ids[idx]}`),
          );
        }
      } else {
        const r = await applyPrivacyPolicyForRowImpl(viewer, options, row);
        if (rowIsError(r)) {
          result[idx] = new ErrorWrapper(r);
        } else {
          result[idx] = r;
        }
      }
    }

    return result;
  }, loaderOptions);
}

class EntLoader<TViewer extends Viewer, TEnt extends Ent<TViewer>>
  implements LoaderWithLoadMany<ID, TEnt | ErrorWrapper | Error>
{
  private loader: DataLoader<ID, TEnt | ErrorWrapper>;
  private map: entCacheMap<TViewer, TEnt>;

  constructor(
    private viewer: TViewer,
    private options: LoadEntOptions<TEnt, TViewer>,
  ) {
    this.map = new entCacheMap(viewer, options);
    this.loader = createEntLoader(this.viewer, this.options, this.map);
  }

  getMap() {
    return this.map;
  }

  async load(id: ID): Promise<TEnt | ErrorWrapper> {
    return this.loader.load(id);
  }

  async loadMany(ids: ID[]): Promise<Array<TEnt | ErrorWrapper | Error>> {
    return this.loader.loadMany(ids);
  }

  prime(id: ID, ent: TEnt | ErrorWrapper) {
    this.loader.prime(id, ent);
  }

  clear(id: ID) {
    this.loader.clear(id);
  }

  clearAll() {
    this.loader.clearAll();
  }
}

export function getEntLoader<TViewer extends Viewer, TEnt extends Ent<TViewer>>(
  viewer: TViewer,
  options: LoadEntOptions<TEnt, TViewer>,
): EntLoader<TViewer, TEnt> {
  if (!viewer.context?.cache) {
    return new EntLoader(viewer, options);
  }
  const name = `ent-loader:${viewer.instanceKey()}:${
    options.loaderFactory.name
  }`;

  return viewer.context.cache.getLoaderWithLoadMany(
    name,
    () => new EntLoader(viewer, options),
  ) as EntLoader<TViewer, TEnt>;
}

export function getEntKey<TEnt extends Ent<TViewer>, TViewer extends Viewer>(
  viewer: TViewer,
  id: ID,
  options: LoadEntOptions<TEnt, TViewer>,
) {
  return `${viewer.instanceKey()}:${options.loaderFactory.name}:${id}`;
}

export async function loadEnt<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
>(
  viewer: TViewer,
  id: ID,
  options: LoadEntOptions<TEnt, TViewer>,
): Promise<TEnt | null> {
  if (
    typeof id !== "string" &&
    typeof id !== "number" &&
    typeof id !== "bigint"
  ) {
    throw new Error(`invalid id ${id} passed to loadEnt`);
  }
  const r = await getEntLoader(viewer, options).load(id);
  return r instanceof ErrorWrapper ? null : r;
}

async function applyPrivacyPolicyForRowAndStoreInEntLoader<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
>(
  viewer: TViewer,
  row: Data,
  options: LoadEntOptions<TEnt, TViewer>,
  // can pass in loader when calling this for multi-id cases...
  loader?: EntLoader<TViewer, TEnt>,
) {
  if (!loader) {
    loader = getEntLoader(viewer, options);
  }
  // TODO every row.id needs to be audited...
  // https://github.com/lolopinto/ent/issues/1064
  const id = row.id;

  // we should check the ent loader cache to see if this is already there
  // TODO hmm... we eventually need a custom data-loader for this too so that it's all done correctly if there's a complicated fetch deep down in graphql
  const result = loader.getMap().get(id);
  if (result !== undefined) {
    return result;
  }

  const r = await applyPrivacyPolicyForRowImpl(viewer, options, row);
  if (rowIsError(r)) {
    loader.prime(id, new ErrorWrapper(r));
    return new ErrorWrapper(r);
  } else {
    loader.prime(id, r);
    return r;
  }
}

// this is the same implementation-wise (right now) as loadEnt. it's just clearer that it's not loaded via ID.
// used for load via email address etc
export async function loadEntViaKey<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
>(
  viewer: TViewer,
  key: any,
  options: LoadEntOptions<TEnt, TViewer>,
): Promise<TEnt | null> {
  const row = await options.loaderFactory
    .createLoader(viewer.context)
    .load(key);
  if (!row) {
    return null;
  }

  const r = await applyPrivacyPolicyForRowAndStoreInEntLoader(
    viewer,
    row,
    options,
  );
  return r instanceof ErrorWrapper ? null : r;
}

export async function loadEntX<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
>(
  viewer: TViewer,
  id: ID,
  options: LoadEntOptions<TEnt, TViewer>,
): Promise<TEnt> {
  if (
    typeof id !== "string" &&
    typeof id !== "number" &&
    typeof id !== "bigint"
  ) {
    throw new Error(`invalid id ${id} passed to loadEntX`);
  }
  const r = await getEntLoader(viewer, options).load(id);
  if (r instanceof ErrorWrapper) {
    throw r.error;
  }
  return r;
}

export async function loadEntXViaKey<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
>(
  viewer: TViewer,
  key: any,
  options: LoadEntOptions<TEnt, TViewer>,
): Promise<TEnt> {
  const row = await options.loaderFactory
    .createLoader(viewer.context)
    .load(key);
  if (!row) {
    // todo make this better
    throw new Error(
      `${options.loaderFactory.name}: couldn't find row for value ${key}`,
    );
  }
  const r = await applyPrivacyPolicyForRowAndStoreInEntLoader(
    viewer,
    row,
    options,
  );
  if (r instanceof ErrorWrapper) {
    throw r.error;
  }
  return r;
}

/**
 * @deprecated use loadCustomEnts
 */
export async function loadEntFromClause<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
>(
  viewer: TViewer,
  options: LoadEntOptions<TEnt, TViewer>,
  clause: clause.Clause,
): Promise<TEnt | null> {
  const rowOptions: LoadRowOptions = {
    ...options,
    clause: clause,
    context: viewer.context,
  };
  const row = await loadRow(rowOptions);
  if (row === null) {
    return null;
  }
  return applyPrivacyPolicyForRow(viewer, options, row);
}

// same as loadEntFromClause
// only works for ents where primary key is "id"
// use loadEnt with a loaderFactory if different
/**
 * @deprecated use loadCustomEnts
 */
export async function loadEntXFromClause<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
>(
  viewer: TViewer,
  options: LoadEntOptions<TEnt, TViewer>,
  clause: clause.Clause,
): Promise<TEnt> {
  const rowOptions: LoadRowOptions = {
    ...options,
    clause: clause,
    context: viewer.context,
  };
  const row = await loadRowX(rowOptions);
  return applyPrivacyPolicyForRowX(viewer, options, row);
}

export async function loadEnts<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
>(
  viewer: TViewer,
  options: LoadEntOptions<TEnt, TViewer>,
  ...ids: ID[]
): Promise<Map<ID, TEnt>> {
  if (!ids.length) {
    return new Map();
  }

  // result
  let m: Map<ID, TEnt> = new Map();

  const ret = await getEntLoader(viewer, options).loadMany(ids);
  for (const r of ret) {
    if (rowIsError(r)) {
      throw r;
    }
    if (r instanceof ErrorWrapper) {
      continue;
    }

    m.set(r.id, r);
  }

  return m;
}

// calls loadEnts and returns the results sorted in the order they were passed in
// useful for EntQuery and other paths where the order matters
export async function loadEntsList<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
>(
  viewer: TViewer,
  options: LoadEntOptions<TEnt, TViewer>,
  ...ids: ID[]
): Promise<TEnt[]> {
  const m = await loadEnts(viewer, options, ...ids);
  const result: TEnt[] = [];
  ids.forEach((id) => {
    let ent = m.get(id);
    if (ent) {
      result.push(ent);
    }
  });
  return result;
}

// we return a map here so that any sorting for queries that exist
// can be done in O(N) time
/**
 * @deperecated use loadCustomEnts
 */
export async function loadEntsFromClause<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
>(
  viewer: TViewer,
  clause: clause.Clause,
  options: LoadEntOptions<TEnt, TViewer>,
): Promise<Map<ID, TEnt>> {
  const rowOptions: LoadRowOptions = {
    ...options,
    clause: clause,
    context: viewer.context,
  };

  const rows = await loadRows(rowOptions);
  return applyPrivacyPolicyForRowsDeprecated(viewer, rows, options);
}

export async function loadCustomEnts<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
  TQueryData extends Data = Data,
  TResultData extends Data = TQueryData,
  TKey = keyof TQueryData,
>(
  viewer: TViewer,
  options: LoadCustomEntOptions<TEnt, TViewer, TResultData>,
  query: CustomQuery<TQueryData, TKey>,
) {
  const rows = await loadCustomData<TQueryData, TResultData, TKey>(
    options,
    query,
    viewer.context,
  );

  return applyPrivacyPolicyForRows(viewer, rows, options);
}

export interface parameterizedQueryOptions {
  query: string;
  values?: any[];
  logValues?: any[];
}

export type CustomQuery<T extends Data = Data, K = keyof T> =
  | string
  | parameterizedQueryOptions
  | clause.Clause<T, K>
  | QueryDataOptions<T, K>;

function isClause<T extends Data = Data, K = keyof T>(
  opts:
    | clause.Clause<T, K>
    | QueryDataOptions<T, K>
    | parameterizedQueryOptions,
): opts is clause.Clause<T, K> {
  const cls = opts as clause.Clause<T, K>;

  return cls.clause !== undefined && cls.values !== undefined;
}

function isParameterizedQuery<T extends Data = Data, K = keyof T>(
  opts: QueryDataOptions<T, K> | parameterizedQueryOptions,
): opts is parameterizedQueryOptions {
  return (opts as parameterizedQueryOptions).query !== undefined;
}

/**
 * Note that if there's default read transformations (e.g. soft delete) and a clause is passed in
 * either as Clause or QueryDataOptions without {disableTransformations: true}, the default transformation
 * (e.g. soft delete) is applied.
 *
 * Passing a full SQL string or Paramterized SQL string doesn't apply it and the given string is sent to the
 * database as written.
 *
 * e.g.
 * Foo.loadCustom(opts, 'SELECT * FROM foo') // doesn't change the query
 * Foo.loadCustom(opts, { query: 'SELECT * FROM foo WHERE id = ?', values: [1]}) // doesn't change the query
 * Foo.loadCustom(opts, query.Eq('time', Date.now())) // changes the query
 * Foo.loadCustom(opts, {
 *   clause:  query.LessEq('time', Date.now()),
 *   limit: 100,
 *   orderby: 'time',
 *  }) // changes the query
 * Foo.loadCustom(opts, {
 *   clause:  query.LessEq('time', Date.now()),
 *   limit: 100,
 *   orderby: 'time',
 *   disableTransformations: false
 *  }) // doesn't change the query
 *
 * For queries that pass in a clause, we batch them with an underlying dataloader so that multiple queries with the same clause
 * or parallel queries with the same clause are batched together.
 *
 * If a raw or parameterized query is passed in, we don't attempt to batch them together and they're executed as is.
 * If you end up with a scenario where you may need to coalesce or batch (non-clause) queries here, you should use some kind of memoization here.
 */
export async function loadCustomData<
  TQueryData extends Data = Data,
  TResultData extends Data = TQueryData,
  K = keyof TQueryData,
>(
  options: SelectCustomDataOptions<TResultData>,
  query: CustomQuery<TQueryData, K>,
  context: Context | undefined,
): Promise<TResultData[]> {
  const rows = await loadCustomDataImpl<TQueryData, TResultData, K>(
    options,
    query,
    context,
  );

  // prime the data so that subsequent fetches of the row with this id are a cache hit.
  if (options.prime) {
    const loader = options.loaderFactory.createLoader(context);
    if (isPrimableLoader(loader) && loader.primeAll !== undefined) {
      for (const row of rows) {
        loader.primeAll(row);
      }
    }
  }
  return rows;
}

// NOTE: if you use a raw query or paramterized query with this,
// you should use `SELECT count(*) as count...`
export async function loadCustomCount<T extends Data = Data, K = keyof T>(
  options: SelectCustomDataOptions<T>,
  query: CustomQuery<T, K>,
  context: Context | undefined,
): Promise<number> {
  // if clause, we'll use the loader and strong typing/coalescing it provides
  if (typeof query !== "string" && isClause(query)) {
    return options.loaderFactory.createCountLoader<K>(context).load(query);
  }

  const rows = await loadCustomDataImpl(
    {
      ...options,
      fields: ["count(1) as count"],
    },
    query,
    context,
  );

  if (rows.length) {
    return parseInt(rows[0].count);
  }
  return 0;
}

function isPrimableLoader(
  loader: Loader<any, Data | null>,
): loader is PrimableLoader<any, Data> {
  return (loader as PrimableLoader<any, Data>) != undefined;
}

async function loadCustomDataImpl<
  TQueryData extends Data = Data,
  TResultData extends Data = TQueryData,
  K = keyof TQueryData,
>(
  options: SelectCustomDataOptions<TResultData>,
  query: CustomQuery<TQueryData, K>,
  context: Context | undefined,
): Promise<TResultData[]> {
  if (typeof query === "string") {
    // no caching, perform raw query
    return performRawQuery(query, [], []) as Promise<TResultData[]>;
  } else if (isClause(query)) {
    const r = await options.loaderFactory
      .createTypedLoader<TQueryData, TResultData, K>(context)
      .load(query);
    return r as unknown as TResultData[];
  } else if (isParameterizedQuery(query)) {
    // no caching, perform raw query
    return performRawQuery(
      query.query,
      query.values || [],
      query.logValues,
    ) as Promise<TResultData[]>;
  } else {
    // this will have rudimentary caching but nothing crazy
    let cls = query.clause;
    if (!query.disableTransformations) {
      cls = clause.getCombinedClause(
        options.loaderFactory.options,
        query.clause,
        true,
      );
    }
    return loadRows({
      ...query,
      ...options,
      context: context,
      // @ts-expect-error
      clause: cls,
    }) as Promise<TResultData[]>;
  }
}

// Derived ents
// no ent caching
export async function loadDerivedEnt<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
>(
  viewer: TViewer,
  data: Data,
  loader: new (viewer: TViewer, data: Data) => TEnt,
): Promise<TEnt | null> {
  const ent = new loader(viewer, data);
  const r = await applyPrivacyPolicyForEnt(viewer, ent, data, {
    ent: loader,
  });
  if (rowIsError(r)) {
    return null;
  }
  return r as TEnt | null;
}

// won't have caching yet either
export async function loadDerivedEntX<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
>(
  viewer: TViewer,
  data: Data,
  loader: new (viewer: TViewer, data: Data) => TEnt,
): Promise<TEnt> {
  const ent = new loader(viewer, data);
  return applyPrivacyPolicyForEntX(viewer, ent, data, { ent: loader });
}

interface FieldPrivacyOptions<
  TEnt extends Ent,
  TViewer extends Viewer = Viewer,
> {
  ent: EntConstructor<TEnt, TViewer>;
  fieldPrivacy?: Map<string, PrivacyPolicy>;
}

// everything calls into this two so should be fine
// TODO is there a smarter way to not instantiate two objects here?
async function applyPrivacyPolicyForEnt<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
>(
  viewer: TViewer,
  ent: TEnt,
  data: Data,
  fieldPrivacyOptions: FieldPrivacyOptions<TEnt, TViewer>,
): Promise<TEnt | Error> {
  const error = await applyPrivacyPolicyImpl(
    viewer,
    ent.getPrivacyPolicy(),
    ent,
  );
  if (error === null) {
    return doFieldPrivacy(viewer, ent, data, fieldPrivacyOptions);
  }
  return error;
}

async function applyPrivacyPolicyForEntX<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
>(
  viewer: TViewer,
  ent: TEnt,
  data: Data,
  options: FieldPrivacyOptions<TEnt, TViewer>,
): Promise<TEnt> {
  const r = await applyPrivacyPolicyForEnt(viewer, ent, data, options);
  if (rowIsError(r)) {
    throw r;
  }
  if (r === null) {
    throw new Error(`couldn't apply privacyPoliy for ent ${ent.id}`);
  }
  return r;
}

async function doFieldPrivacy<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
>(
  viewer: TViewer,
  ent: TEnt,
  data: Data,
  options: FieldPrivacyOptions<TEnt, TViewer>,
): Promise<TEnt> {
  if (!options.fieldPrivacy) {
    return ent;
  }
  const promises: Promise<void>[] = [];
  let somethingChanged = false;
  const clone = { ...data };
  const origData = {
    ...data,
  };
  for (const [k, policy] of options.fieldPrivacy) {
    const curr = clone[k];
    if (curr === null || curr === undefined) {
      continue;
    }

    promises.push(
      (async () => {
        // don't do anything if key is null or for some reason missing
        const r = await applyPrivacyPolicy(viewer, policy, ent);
        if (!r) {
          clone[k] = null;
          somethingChanged = true;
        }
      })(),
    );
  }
  await Promise.all(promises);
  if (somethingChanged) {
    // have to create new instance
    const ent = new options.ent(viewer, clone);
    ent.__setRawDBData(origData);
    return ent;
  }
  ent.__setRawDBData(origData);
  return ent;
}

export function logQuery(query: string, logValues: any[]) {
  log("query", {
    query: query,
    values: logValues,
  });
  logTrace();
}

// TODO long term figure out if this API should be exposed
export async function loadRowX(options: LoadRowOptions): Promise<Data> {
  const result = await loadRow(options);
  if (result == null) {
    // todo make this better
    // make clause have a description
    throw new Error(
      `couldn't find row for query ${options.clause.clause(
        1,
      )} with values ${options.clause.values()}`,
    );
  }
  return result;
}

// primitive data fetching. called by loaders
export async function loadRow(options: LoadRowOptions): Promise<Data | null> {
  let cache = options.context?.cache;
  if (cache) {
    let row = cache.getCachedRow(options);
    if (row !== null) {
      return row;
    }
  }

  const query = buildQuery(options);
  logQuery(query, options.clause.logValues());
  const pool = DB.getInstance().getPool();

  const res = await pool.query(query, options.clause.values());
  if (res.rowCount != 1) {
    if (res.rowCount > 1) {
      log("error", "got more than one row for query " + query);
    }
    return null;
  }

  // put the row in the cache...
  if (cache) {
    cache.primeCache(options, res.rows[0]);
  }

  return res.rows[0];
}

var _logQueryWithError = false;

export function ___setLogQueryErrorWithError(val: boolean | undefined) {
  _logQueryWithError = val || false;
}

// this always goes to the db, no cache, nothing
export async function performRawQuery(
  query: string,
  values: any[],
  logValues?: any[],
): Promise<Data[]> {
  const pool = DB.getInstance().getPool();

  logQuery(query, logValues || []);
  try {
    const res = await pool.queryAll(query, values);
    return res.rows;
  } catch (e) {
    if (_logQueryWithError) {
      const msg = (e as Error).message;
      throw new Error(
        `error \`${msg}\` running query: \`${query}\` with values: \`${logValues}\``,
      );
    }
    throw e;
  }
}

// TODO this should throw, we can't be hiding errors here
export async function loadRows(options: LoadRowsOptions): Promise<Data[]> {
  let cache = options.context?.cache;
  if (cache) {
    let rows = cache.getCachedRows(options);
    if (rows !== null) {
      return rows;
    }
  }

  const query = buildQuery(options);
  const r = await performRawQuery(
    query,
    options.clause.values(),
    options.clause.logValues(),
  );
  if (cache) {
    // put the rows in the cache...
    cache.primeCache(options, r);
  }
  return r;
}

interface GroupQueryOptions<T extends Data, K = keyof T> {
  tableName: string;

  // extra clause to join
  clause?: clause.Clause<T, K>;
  groupColumn: K;
  fields: K[];
  values: any[];
  orderby?: OrderBy;
  limit: number;
}

// this is used for queries when we select multiple ids at once
export function buildGroupQuery<T extends Data = Data, K = keyof T>(
  options: GroupQueryOptions<T, K>,
): [string, clause.Clause<T, K>] {
  const fields = [...options.fields, "row_number()"];

  let cls = clause.In<T, K>(options.groupColumn, ...options.values);
  if (options.clause) {
    cls = clause.And<T, K>(cls, options.clause);
  }
  let orderby = "";
  if (options.orderby) {
    orderby = `ORDER BY ${getOrderByPhrase(options.orderby)}`;
  }

  // window functions work in sqlite!
  //    https://www.sqlite.org/windowfunctions.html
  return [
    `SELECT * FROM (SELECT ${fields.join(",")} OVER (PARTITION BY ${
      options.groupColumn
    } ${orderby}) as row_num FROM ${options.tableName} WHERE ${cls.clause(
      1,
    )}) t WHERE row_num <= ${options.limit}`,
    cls,
  ];
}

function isSyncQueryer(queryer: Queryer): queryer is SyncQueryer {
  return (queryer as SyncQueryer).execSync !== undefined;
}

async function mutateRow(
  queryer: Queryer,
  query: string,
  values: any[],
  logValues: any[],
  options: DataOptions,
) {
  logQuery(query, logValues);

  let cache = options.context?.cache;
  let res: QueryResult<QueryResultRow>;
  try {
    if (isSyncQueryer(queryer)) {
      res = queryer.execSync(query, values);
    } else {
      res = await queryer.exec(query, values);
    }
  } catch (e) {
    if (_logQueryWithError) {
      const msg = (e as Error).message;
      throw new Error(`error \`${msg}\` running query: \`${query}\``);
    }
    throw e;
  }
  if (cache) {
    cache.clearCache();
  }
  return res;
}

function mutateRowSync(
  queryer: SyncQueryer,
  query: string,
  values: any[],
  logValues: any[],
  options: DataOptions,
) {
  logQuery(query, logValues);

  let cache = options.context?.cache;
  try {
    const res = queryer.execSync(query, values);
    if (cache) {
      cache.clearCache();
    }
    return res;
  } catch (e) {
    if (_logQueryWithError) {
      const msg = (e as Error).message;
      throw new Error(`error \`${msg}\` running query: \`${query}\``);
    }
    throw e;
  }
}

export function buildInsertQuery(
  options: CreateRowOptions,
  suffix?: string,
): [string, string[], string[]] {
  let fields: string[] = [];
  let values: any[] = [];
  let logValues: any[] = [];
  let valsString: string[] = [];
  let idx = 1;
  const dialect = DB.getDialect();
  for (const key in options.fields) {
    fields.push(key);
    values.push(options.fields[key]);
    if (options.fieldsToLog) {
      logValues.push(options.fieldsToLog[key]);
    }
    if (dialect === Dialect.Postgres) {
      valsString.push(`$${idx}`);
    } else {
      valsString.push("?");
    }
    idx++;
  }

  const cols = fields.join(", ");
  const vals = valsString.join(", ");

  let query = `INSERT INTO ${options.tableName} (${cols}) VALUES (${vals})`;

  if (options.onConflict) {
    let onConflict = "";
    if (options.onConflict.onConflictConstraint) {
      onConflict = `ON CONFLICT ON CONSTRAINT ${options.onConflict.onConflictConstraint}`;
    } else {
      onConflict = `ON CONFLICT(${options.onConflict.onConflictCols.join(
        ", ",
      )})`;
    }
    if (options.onConflict.updateCols?.length) {
      onConflict += ` DO UPDATE SET ${options.onConflict.updateCols
        .map((f) => `${f} = EXCLUDED.${f}`)
        .join(", ")}`;
    } else {
      onConflict += ` DO NOTHING`;
    }
    query = query + " " + onConflict;
  }

  if (suffix) {
    query += " " + suffix;
  }

  return [query, values, logValues];
}

// TODO: these three are not to be exported out of this package
// only from this file
export async function createRow(
  queryer: Queryer,
  options: CreateRowOptions,
  suffix: string,
): Promise<Data | null> {
  const [query, values, logValues] = buildInsertQuery(options, suffix);

  const res = await mutateRow(queryer, query, values, logValues, options);

  if (res?.rowCount === 1) {
    return res.rows[0];
  }
  return null;
}

export function createRowSync(
  queryer: SyncQueryer,
  options: CreateRowOptions,
  suffix: string,
): Data | null {
  const [query, values, logValues] = buildInsertQuery(options, suffix);

  const res = mutateRowSync(queryer, query, values, logValues, options);

  if (res?.rowCount === 1) {
    return res.rows[0];
  }
  return null;
}

export function buildUpdateQuery(
  options: EditRowOptions,
  suffix?: string,
): [string, any[], any[]] {
  let valsString: string[] = [];
  let values: any[] = [];
  let logValues: any[] = [];
  const dialect = DB.getDialect();

  let idx = 1;
  for (const key in options.fields) {
    if (options.expressions && options.expressions.has(key)) {
      const cls = options.expressions.get(key)!;
      valsString.push(`${key} = ${cls.clause(idx)}`);
      // TODO need to test a clause with more than one value...
      const newVals = cls.values();
      idx += newVals.length;
      values.push(...newVals);
      logValues.push(...cls.logValues());
    } else {
      const val = options.fields[key];
      values.push(val);
      if (options.fieldsToLog) {
        logValues.push(options.fieldsToLog[key]);
      }
      // TODO would be nice to use clause here. need update version of the queries so that
      // we don't have to handle dialect specifics here
      // can't use clause because of IS NULL
      // valsString.push(clause.Eq(key, val).clause(idx));
      if (dialect === Dialect.Postgres) {
        valsString.push(`${key} = $${idx}`);
      } else {
        valsString.push(`${key} = ?`);
      }
      idx++;
    }
  }

  const vals = valsString.join(", ");

  let query = `UPDATE ${options.tableName} SET ${vals} WHERE `;

  query = query + options.whereClause.clause(idx);
  values.push(...options.whereClause.values());
  if (options.fieldsToLog) {
    logValues.push(...options.whereClause.logValues());
  }

  if (suffix) {
    query = query + " " + suffix;
  }

  return [query, values, logValues];
}

export async function editRow(
  queryer: Queryer,
  options: EditRowOptions,
  suffix?: string,
): Promise<Data | null> {
  const [query, values, logValues] = buildUpdateQuery(options, suffix);

  const res = await mutateRow(queryer, query, values, logValues, options);

  if (res?.rowCount == 1) {
    // for now assume id primary key
    // TODO make this extensible as needed.
    let row = res.rows[0];
    return row;
  }
  return null;
}

export function editRowSync(
  queryer: SyncQueryer,
  options: EditRowOptions,
  suffix?: string,
): Data | null {
  const [query, values, logValues] = buildUpdateQuery(options, suffix);

  const res = mutateRowSync(queryer, query, values, logValues, options);

  if (res?.rowCount == 1) {
    // for now assume id primary key
    // TODO make this extensible as needed.
    let row = res.rows[0];
    return row;
  }
  return null;
}

export async function deleteRows(
  queryer: Queryer,
  options: DataOptions,
  cls: clause.Clause,
): Promise<void> {
  const query = `DELETE FROM ${options.tableName} WHERE ${cls.clause(1)}`;
  await mutateRow(queryer, query, cls.values(), cls.logValues(), options);
}

export function deleteRowsSync(
  queryer: SyncQueryer,
  options: DataOptions,
  cls: clause.Clause,
): void {
  const query = `DELETE FROM ${options.tableName} WHERE ${cls.clause(1)}`;
  mutateRowSync(queryer, query, cls.values(), cls.logValues(), options);
}

export class AssocEdge {
  id1: ID;
  id1Type: string;
  edgeType: string;
  id2: ID;
  id2Type: string;
  time: Date;
  data?: string | null;

  private rawData: Data;

  constructor(data: Data) {
    this.id1 = data.id1;
    this.id1Type = data.id1_type;
    this.id2 = data.id2;
    this.id2Type = data.id2_type;
    this.edgeType = data.edge_type;
    this.time = data.time;
    this.data = data.data;
    this.rawData = data;
  }

  __getRawData() {
    // incase there's extra db fields. useful for tests
    // in production, a subclass of this should be in use so we won't need this...
    return this.rawData;
  }

  getCursor(): string {
    return getCursor({
      row: this,
      col: "id2",
    });
  }
}

interface cursorOptions {
  row: Data;
  col: string;
  cursorKey?: string; // used by tests. if cursor is from one column but the key in the name is different e.g. time for assocs and created_at when taken from the object
  conv?: (any: any) => any;
}

// TODO eventually update this for sortCol time unique keys
export function getCursor(opts: cursorOptions) {
  const { row, col, conv } = opts;
  //  row: Data, col: string, conv?: (any) => any) {
  if (!row) {
    throw new Error(`no row passed to getCursor`);
  }
  let datum = row[col];
  if (!datum) {
    return "";
  }
  if (conv) {
    datum = conv(datum);
  }

  const cursorKey = opts.cursorKey || col;
  const str = `${cursorKey}:${datum}`;
  return Buffer.from(str, "ascii").toString("base64");
}

export class AssocEdgeData {
  edgeType: string;
  edgeName: string;
  symmetricEdge: boolean;
  inverseEdgeType?: string;
  edgeTable: string;

  constructor(data: Data) {
    this.edgeType = data.edge_type;
    this.edgeName = data.edge_name;
    this.symmetricEdge = data.symmetric_edge;
    this.inverseEdgeType = data.inverse_edge_type;
    this.edgeTable = data.edge_table;
  }
}

const assocEdgeFields = [
  "edge_type",
  "edge_name",
  "symmetric_edge",
  "inverse_edge_type",
  "edge_table",
];

export const assocEdgeLoader = createAssocEdgeConfigLoader({
  tableName: "assoc_edge_config",
  fields: assocEdgeFields,
  key: "edge_type",
  keyType: "uuid",
});

// we don't expect assoc_edge_config information to change
// so not using ContextCache but just caching it as needed once per server

export async function loadEdgeData(
  edgeType: string,
): Promise<AssocEdgeData | null> {
  const row = await assocEdgeLoader.load(edgeType);
  if (!row) {
    return null;
  }
  return new AssocEdgeData(row);
}

export async function loadEdgeDatas(
  ...edgeTypes: string[]
): Promise<Map<string, AssocEdgeData>> {
  if (!edgeTypes.length) {
    return new Map();
  }

  const rows = await assocEdgeLoader.loadMany(edgeTypes);
  const m = new Map<string, AssocEdgeData>();
  rows.forEach((row) => {
    if (!row) {
      return;
    }
    if (rowIsError(row)) {
      throw row;
    }
    m.set(row["edge_type"], new AssocEdgeData(row));
  });
  return m;
}

const edgeFields = [
  "id1",
  "id1_type",
  "edge_type",
  "id2",
  "id2_type",
  "time",
  "data",
];

export interface AssocEdgeConstructor<T extends AssocEdge> {
  new (row: Data): T;
}

interface loadEdgesOptions {
  id1: ID;
  edgeType: string;
  context?: Context;
  queryOptions?: EdgeQueryableDataOptions;
}

interface loadCustomEdgesOptions<T extends AssocEdge> extends loadEdgesOptions {
  ctr: AssocEdgeConstructor<T>;
}

let defaultLimit = 1000;

export function setDefaultLimit(limit: number) {
  defaultLimit = limit;
}

export function getDefaultLimit() {
  return defaultLimit;
}

function defaultEdgeQueryOptions(
  edgeData: AssocEdgeData,
  id1: ID,
  edgeType: string,
  id2?: ID,
  id1Clause?: (edgeData: AssocEdgeData) => clause.Clause,
): Required<Omit<EdgeQueryableDataOptions, "disableTransformations">> {
  let id1cls: clause.Clause = clause.Eq("id1", id1);
  if (id1Clause) {
    id1cls = id1Clause(edgeData);
  }
  let cls = clause.And(id1cls, clause.Eq("edge_type", edgeType));
  if (id2) {
    cls = clause.And(cls, clause.Eq("id2", id2));
  }
  return {
    clause: cls,
    orderby: [
      {
        column: "time",
        direction: "DESC",
      },
    ],
    limit: defaultLimit,
  };
}

export async function loadEdges(
  options: loadEdgesOptions,
): Promise<AssocEdge[]> {
  return loadCustomEdges({ ...options, ctr: AssocEdge });
}

export function getEdgeClauseAndFields(
  cls: clause.Clause,
  options: Pick<loadEdgesOptions, "queryOptions">,
) {
  let fields = edgeFields;

  const transformEdgeRead = __getGlobalSchema()?.transformEdgeRead;
  if (transformEdgeRead) {
    const transformClause = transformEdgeRead();
    if (!options.queryOptions?.disableTransformations) {
      cls = clause.And(cls, transformClause);
    }
    fields = edgeFields.concat(transformClause.columns() as string[]);
  }
  return {
    cls,
    fields,
  };
}

export async function loadCustomEdges<T extends AssocEdge>(
  options: loadCustomEdgesOptions<T>,
): Promise<T[]> {
  const {
    cls: actualClause,
    fields,
    defaultOptions,
    tableName,
  } = await loadEdgesInfo(options);

  const rows = await loadRows({
    tableName,
    fields: fields,
    clause: actualClause,
    orderby: options.queryOptions?.orderby || defaultOptions.orderby,
    limit: options.queryOptions?.limit || defaultOptions.limit,
    context: options.context,
  });
  return rows.map((row) => {
    return new options.ctr(row);
  });
}

async function loadEdgesInfo<T extends AssocEdge>(
  options: loadCustomEdgesOptions<T>,
  id2?: ID,
  id1Clause?: (edgeData: AssocEdgeData) => clause.Clause,
) {
  const { id1, edgeType } = options;
  const edgeData = await loadEdgeData(edgeType);
  if (!edgeData) {
    throw new Error(`error loading edge data for ${edgeType}`);
  }

  const defaultOptions = defaultEdgeQueryOptions(
    edgeData,
    id1,
    edgeType,
    id2,
    id1Clause,
  );
  let cls = defaultOptions.clause;
  if (options.queryOptions?.clause) {
    cls = clause.And(cls, options.queryOptions.clause);
  }

  return {
    ...getEdgeClauseAndFields(cls, options),
    defaultOptions,
    tableName: edgeData.edgeTable,
  };
}

export async function loadUniqueEdge(
  options: loadEdgesOptions,
): Promise<AssocEdge | null> {
  const { id1, edgeType, context } = options;

  const edgeData = await loadEdgeData(edgeType);
  if (!edgeData) {
    throw new Error(`error loading edge data for ${edgeType}`);
  }
  const { cls, fields } = getEdgeClauseAndFields(
    clause.And(clause.Eq("id1", id1), clause.Eq("edge_type", edgeType)),
    options,
  );

  const row = await loadRow({
    tableName: edgeData.edgeTable,
    fields: fields,
    clause: cls,
    context,
  });
  if (!row) {
    return null;
  }
  return new AssocEdge(row);
}

export async function loadUniqueNode<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
>(
  viewer: TViewer,
  id1: ID,
  edgeType: string,
  options: LoadEntOptions<TEnt, TViewer>,
): Promise<TEnt | null> {
  const edge = await loadUniqueEdge({
    id1,
    edgeType,
    context: viewer.context,
  });
  if (!edge) {
    return null;
  }
  return loadEnt(viewer, edge.id2, options);
}

export async function loadRawEdgeCountX(
  options: loadEdgesOptions,
): Promise<number> {
  const { id1, edgeType, context } = options;
  const edgeData = await loadEdgeData(edgeType);
  if (!edgeData) {
    throw new Error(`error loading edge data for ${edgeType}`);
  }

  const { cls } = getEdgeClauseAndFields(
    clause.And(clause.Eq("id1", id1), clause.Eq("edge_type", edgeType)),
    options,
  );
  const row = await loadRowX({
    tableName: edgeData.edgeTable,
    // sqlite needs as count otherwise it returns count(1)
    fields: ["count(1) as count"],
    clause: cls,
    context,
  });
  return parseInt(row["count"], 10) || 0;
}

interface loadEdgeForIDOptions<T extends AssocEdge>
  extends loadCustomEdgesOptions<T> {
  id2: ID;
}

export async function loadEdgeForID2<T extends AssocEdge>(
  options: loadEdgeForIDOptions<T>,
): Promise<T | undefined> {
  const {
    cls: actualClause,
    fields,
    tableName,
  } = await loadEdgesInfo(options, options.id2);

  const row = await loadRow({
    tableName,
    fields,
    clause: actualClause,
    context: options.context,
  });
  if (row) {
    return new options.ctr(row);
  }
}

export async function loadTwoWayEdges<T extends AssocEdge>(
  opts: loadCustomEdgesOptions<T>,
): Promise<T[]> {
  const {
    cls: actualClause,
    fields,
    tableName,
  } = await loadEdgesInfo(opts, undefined, (edgeData: AssocEdgeData) => {
    const { clause: subClause } = defaultEdgeQueryOptions(
      edgeData,
      opts.id1,
      opts.edgeType,
    );

    const { cls } = getEdgeClauseAndFields(subClause, opts);
    const subquery: QueryableDataOptions = {
      tableName: edgeData.edgeTable,
      fields: ["id2"],
      clause: cls,
    };
    return clause.ColInQuery("id1", subquery);
  });

  const rows = await loadRows({
    tableName,
    fields,
    clause: actualClause,
    context: opts.context,
  });
  return rows as T[];
}

export async function loadNodesByEdge<T extends Ent>(
  viewer: Viewer,
  id1: ID,
  edgeType: string,
  options: LoadEntOptions<T>,
): Promise<T[]> {
  // load edges
  const rows = await loadEdges({
    id1,
    edgeType,
    context: viewer.context,
  });

  // extract id2s
  const ids = rows.map((row) => row.id2);

  return loadEntsList(viewer, options, ...ids);
}

export async function applyPrivacyPolicyForRow<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
>(
  viewer: TViewer,
  options: LoadEntOptions<TEnt, TViewer>,
  row: Data,
): Promise<TEnt | null> {
  const r = await applyPrivacyPolicyForRowImpl(viewer, options, row);
  return rowIsError(r) ? null : r;
}

async function applyPrivacyPolicyForRowImpl<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
>(
  viewer: TViewer,
  options: LoadEntOptions<TEnt, TViewer>,
  row: Data,
): Promise<TEnt | Error> {
  const ent = new options.ent(viewer, row);
  return applyPrivacyPolicyForEnt(viewer, ent, row, options);
}

async function applyPrivacyPolicyForRowX<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
>(
  viewer: TViewer,
  options: LoadEntOptions<TEnt, TViewer>,
  row: Data,
): Promise<TEnt> {
  const ent = new options.ent(viewer, row);
  return applyPrivacyPolicyForEntX(viewer, ent, row, options);
}

// deprecated. doesn't use entcache
async function applyPrivacyPolicyForRowsDeprecated<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
>(viewer: TViewer, rows: Data[], options: LoadEntOptions<TEnt, TViewer>) {
  let m: Map<ID, TEnt> = new Map();
  // apply privacy logic
  await Promise.all(
    rows.map(async (row) => {
      let privacyEnt = await applyPrivacyPolicyForRow(viewer, options, row);
      if (privacyEnt) {
        m.set(privacyEnt.id, privacyEnt);
      }
    }),
  );
  return m;
}

export async function applyPrivacyPolicyForRows<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
>(viewer: TViewer, rows: Data[], options: LoadEntOptions<TEnt, TViewer>) {
  const result: TEnt[] = new Array(rows.length);

  if (!rows.length) {
    return [];
  }

  const entLoader = getEntLoader(viewer, options);

  await Promise.all(
    rows.map(async (row, idx) => {
      const r = await applyPrivacyPolicyForRowAndStoreInEntLoader(
        viewer,
        row,
        options,
        entLoader,
      );
      if (r instanceof ErrorWrapper) {
        return;
      }
      result[idx] = r;
    }),
  );
  // filter ents that aren't visible because of privacy
  return result.filter((r) => r !== undefined);
}

// given a viewer, an id pair, and a map of edgeEnum to EdgeType
// return the edgeEnum that's set in the group
export async function getEdgeTypeInGroup<T extends string>(
  viewer: Viewer,
  id1: ID,
  id2: ID,
  m: Map<T, string>,
): Promise<[T, AssocEdge] | undefined> {
  let promises: Promise<[T, AssocEdge | undefined] | undefined>[] = [];
  const edgeDatas = await loadEdgeDatas(...Array.from(m.values()));

  let tableToEdgeEnumMap = new Map<string, T[]>();
  for (const [edgeEnum, edgeType] of m) {
    const edgeData = edgeDatas.get(edgeType);
    if (!edgeData) {
      throw new Error(`could not load edge data for '${edgeType}'`);
    }
    const l = tableToEdgeEnumMap.get(edgeData.edgeTable) ?? [];
    l.push(edgeEnum);
    tableToEdgeEnumMap.set(edgeData.edgeTable, l);
  }
  tableToEdgeEnumMap.forEach((edgeEnums, tableName) => {
    promises.push(
      (async () => {
        const edgeTypes = edgeEnums.map((edgeEnum) => m.get(edgeEnum)!);

        const { cls, fields } = getEdgeClauseAndFields(
          clause.And(
            clause.Eq("id1", id1),
            clause.UuidIn("edge_type", edgeTypes),
            clause.Eq("id2", id2),
          ),
          {},
        );

        const rows = await loadRows({
          tableName,
          fields,
          clause: cls,
          context: viewer.context,
        });

        const row = rows[0];
        if (row) {
          const edgeType = row.edge_type;
          for (const [k, v] of m) {
            if (v === edgeType) {
              return [k, new AssocEdge(row)];
            }
          }
        }
      })(),
    );
  });
  const results = await Promise.all(promises);
  for (const res of results) {
    if (res && res[1]) {
      return [res[0], res[1]];
    }
  }
}
