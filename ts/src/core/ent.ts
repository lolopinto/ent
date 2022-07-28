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
  SelectBaseDataOptions,
  SelectDataOptions,
  CreateRowOptions,
  QueryDataOptions,
  EntConstructor,
  PrivacyPolicy,
} from "./base";

import { applyPrivacyPolicy, applyPrivacyPolicyX } from "./privacy";
import { Executor } from "../action/action";

import * as clause from "./clause";
import { WriteOperation, Builder } from "../action";
import { log, logEnabled, logTrace } from "./logger";
import DataLoader from "dataloader";
import { ObjectLoader } from "./loaders";
import { getStorageKey, GlobalSchema, SQLStatementOperation } from "../schema/";
import { TransformedUpdateOperation } from "@snowtop/ent";
import { glob } from "glob";
import { textSpanOverlapsWith } from "typescript";

// TODO kill this and createDataLoader
class cacheMap {
  private m = new Map();
  constructor(private options: DataOptions) {}
  get(key: string) {
    const ret = this.m.get(key);
    if (ret) {
      log("cache", {
        "dataloader-cache-hit": key,
        "tableName": this.options.tableName,
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

function createDataLoader(options: SelectDataOptions) {
  const loaderOptions: DataLoader.Options<ID, Data | null> = {};

  // if query logging is enabled, we should log what's happening with loader
  if (logEnabled("query")) {
    loaderOptions.cacheMap = new cacheMap(options);
  }

  // something here brokwn with strict:true
  return new DataLoader<ID, Data | null>(async (ids: ID[]) => {
    if (!ids.length) {
      return [];
    }
    let col = options.key;
    const rowOptions: LoadRowOptions = {
      ...options,
      clause: clause.In(col, ...ids),
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

// Ent accessors
export async function loadEnt<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
>(
  viewer: TViewer,
  id: ID,
  options: LoadEntOptions<TEnt, TViewer>,
): Promise<TEnt | null> {
  const row = await options.loaderFactory.createLoader(viewer.context).load(id);
  return await applyPrivacyPolicyForRow(viewer, options, row);
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
  return await applyPrivacyPolicyForRow(viewer, options, row);
}

export async function loadEntX<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
>(
  viewer: TViewer,
  id: ID,
  options: LoadEntOptions<TEnt, TViewer>,
): Promise<TEnt> {
  const row = await options.loaderFactory.createLoader(viewer.context).load(id);
  if (!row) {
    // todo make this better
    throw new Error(
      `${options.loaderFactory.name}: couldn't find row for value ${id}`,
    );
  }
  return await applyPrivacyPolicyForRowX(viewer, options, row);
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
  return await applyPrivacyPolicyForRowX(viewer, options, row);
}

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
  return await applyPrivacyPolicyForRow(viewer, options, row);
}

// same as loadEntFromClause
// only works for ents where primary key is "id"
// use loadEnt with a loaderFactory if different
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
  return await applyPrivacyPolicyForRowX(viewer, options, row);
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
  let loaded = false;
  let rows: (Error | Data | null)[] = [];
  // TODO loadMany everywhere
  const l = options.loaderFactory.createLoader(viewer.context);
  if (l.loadMany) {
    loaded = true;
    rows = await l.loadMany(ids);
  }

  // TODO rewrite all of this
  let m: Map<ID, TEnt> = new Map();

  if (loaded) {
    let rows2: Data[] = [];
    for (const row of rows) {
      if (!row) {
        continue;
      }
      if (row instanceof Error) {
        throw row;
      }
      rows2.push(row);
    }
    m = await applyPrivacyPolicyForRows(viewer, rows2, options);
  } else {
    m = await loadEntsFromClause(
      viewer,
      // this is always "id" if not using an ObjectLoaderFactory
      clause.In("id", ...ids),
      options,
    );
  }
  return m;

  // TODO do we want to change this to be a map not a list so that it's easy to check for existence?
  // TODO eventually this should be doing a cache then db queyr and maybe depend on dataloader to get all the results at once
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
  return await applyPrivacyPolicyForRows(viewer, rows, options);
}

export async function loadCustomEnts<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
>(
  viewer: TViewer,
  options: LoadCustomEntOptions<TEnt, TViewer>,
  query: CustomQuery,
) {
  const rows = await loadCustomData(options, query, viewer.context);

  const result: TEnt[] = new Array(rows.length);
  await Promise.all(
    rows.map(async (row, idx) => {
      const ent = new options.ent(viewer, row);
      let privacyEnt = await applyPrivacyPolicyForEnt(
        viewer,
        ent,
        row,
        options,
      );

      if (privacyEnt) {
        result[idx] = privacyEnt;
      }
    }),
  );
  // filter ents that aren't visible because of privacy
  return result.filter((r) => r !== undefined);
}

interface rawQueryOptions {
  query: string;
  values?: any[];
  logValues?: any[];
}

export type CustomQuery =
  | string
  | rawQueryOptions
  | clause.Clause
  | QueryDataOptions;

function isClause(
  opts: clause.Clause | QueryDataOptions | rawQueryOptions,
): opts is clause.Clause {
  const cls = opts as clause.Clause;

  return cls.clause !== undefined && cls.values !== undefined;
}

function isRawQuery(
  opts: QueryDataOptions | rawQueryOptions,
): opts is rawQueryOptions {
  return (opts as rawQueryOptions).query !== undefined;
}

export async function loadCustomData(
  options: SelectBaseDataOptions,
  query: CustomQuery,
  context: Context | undefined,
): Promise<Data[]> {
  if (typeof query === "string") {
    // no caching, perform raw query
    return await performRawQuery(query, [], []);
  } else if (isClause(query)) {
    // this will have rudimentary caching but nothing crazy
    return await loadRows({
      ...options,
      clause: query,
      context: context,
    });
  } else if (isRawQuery(query)) {
    // no caching, perform raw query
    return await performRawQuery(
      query.query,
      query.values || [],
      query.logValues,
    );
  } else {
    // this will have rudimentary caching but nothing crazy
    return await loadRows({
      ...query,
      ...options,
      context: context,
    });
  }
}

// Derived ents
export async function loadDerivedEnt<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
>(
  viewer: TViewer,
  data: Data,
  loader: new (viewer: TViewer, data: Data) => TEnt,
): Promise<TEnt | null> {
  const ent = new loader(viewer, data);
  return await applyPrivacyPolicyForEnt(viewer, ent, data, {
    ent: loader,
  });
}

export async function loadDerivedEntX<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
>(
  viewer: TViewer,
  data: Data,
  loader: new (viewer: TViewer, data: Data) => TEnt,
): Promise<TEnt> {
  const ent = new loader(viewer, data);
  return await applyPrivacyPolicyForEntX(viewer, ent, data, { ent: loader });
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
  ent: TEnt | null,
  data: Data,
  fieldPrivacyOptions: FieldPrivacyOptions<TEnt, TViewer>,
): Promise<TEnt | null> {
  if (ent) {
    const visible = await applyPrivacyPolicy(
      viewer,
      ent.getPrivacyPolicy(),
      ent,
    );
    if (!visible) {
      return null;
    }
    return doFieldPrivacy(viewer, ent, data, fieldPrivacyOptions);
  }
  return null;
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
  // this will throw
  await applyPrivacyPolicyX(viewer, ent.getPrivacyPolicy(), ent);
  return doFieldPrivacy(viewer, ent, data, options);
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
  for (const [k, policy] of options.fieldPrivacy) {
    promises.push(
      (async () => {
        // don't do anything if key is null or for some reason missing
        const curr = data[k];
        if (curr === null || curr === undefined) {
          return;
        }
        const r = await applyPrivacyPolicy(viewer, policy, ent);
        if (!r) {
          data[k] = null;
          somethingChanged = true;
        }
      })(),
    );
  }
  await Promise.all(promises);
  if (somethingChanged) {
    // have to create new instance
    return new options.ent(viewer, data);
  }
  return ent;
}

function logQuery(query: string, logValues: any[]) {
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
  try {
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
  } catch (e) {
    // an example of an error being suppressed
    // another one. TODO https://github.com/lolopinto/ent/issues/862
    log("error", e);
    return null;
  }
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
    // TODO need to change every query to catch an error!
    log("error", e);
    return [];
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

// private to ent
export function buildQuery(options: QueryableDataOptions): string {
  const fields = options.fields.join(", ");
  // always start at 1
  const whereClause = options.clause.clause(1);
  let query = `SELECT ${fields} FROM ${options.tableName} WHERE ${whereClause}`;
  if (options.groupby) {
    query = `${query} GROUP BY ${options.groupby}`;
  }
  if (options.orderby) {
    query = `${query} ORDER BY ${options.orderby}`;
  }
  if (options.limit) {
    query = `${query} LIMIT ${options.limit}`;
  }
  return query;
}

interface GroupQueryOptions {
  tableName: string;

  // extra clause to join
  clause?: clause.Clause;
  groupColumn: string;
  fields: string[];
  values: any[];
  orderby?: string;
  limit: number;
}

// this is used for queries when we select multiple ids at once
export function buildGroupQuery(
  options: GroupQueryOptions,
): [string, clause.Clause] {
  const fields = [...options.fields, "row_number()"];

  let cls = clause.In(options.groupColumn, ...options.values);
  if (options.clause) {
    cls = clause.And(cls, options.clause);
  }
  let orderby = "";
  if (options.orderby) {
    orderby = `ORDER BY ${options.orderby}`;
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

export interface DataOperation<T extends Ent = Ent> {
  // any data that needs to be fetched before the write should be fetched here
  // because of how SQLite works, we can't use asynchronous fetches during the write
  // so we batch up fetching to be done beforehand here
  preFetch?(queryer: Queryer, context?: Context): Promise<void>;

  // performWriteSync is called for SQLITE and APIs that don't support asynchronous writes
  performWriteSync(queryer: SyncQueryer, context?: Context): void;
  performWrite(queryer: Queryer, context?: Context): Promise<void>;

  placeholderID?: ID;
  returnedRow?(): Data | null; // optional to get the raw row
  createdEnt?(viewer: Viewer): T | null; // optional to indicate the ent that was created
  resolve?(executor: Executor): void; //throws?

  // any data that needs to be fetched asynchronously post write|post transaction
  postFetch?(queryer: Queryer, context?: Context): Promise<void>;
}

export interface EditNodeOptions<T extends Ent> extends EditRowOptions {
  fieldsToResolve: string[];
  loadEntOptions: LoadEntOptions<T>;
  placeholderID?: ID;
  key: string;
}

export class EditNodeOperation<T extends Ent> implements DataOperation {
  row: Data | null = null;
  placeholderID?: ID | undefined;

  constructor(
    public options: EditNodeOptions<T>,
    private existingEnt: Ent | null = null,
  ) {
    this.placeholderID = options.placeholderID;
  }

  resolve<T extends Ent>(executor: Executor): void {
    if (!this.options.fieldsToResolve.length) {
      return;
    }

    let fields = this.options.fields;
    this.options.fieldsToResolve.forEach((fieldName) => {
      let value: Builder<T> | null = fields[fieldName];
      if (!value) {
        throw new Error(
          `trying to resolve field ${fieldName} but not a valid field`,
        );
      }
      let ent = executor.resolveValue(value.placeholderID);
      if (!ent) {
        throw new Error(
          `couldn't resolve field \`${fieldName}\` with value ${value.placeholderID}`,
        );
      }
      fields[fieldName] = ent.id;
    });
    this.options.fields = fields;
  }

  private hasData(data: Data) {
    for (const _k in data) {
      return true;
    }
    return false;
  }

  async performWrite(queryer: Queryer, context?: Context): Promise<void> {
    let options = {
      ...this.options,
      context,
    };
    if (this.existingEnt) {
      if (this.hasData(options.fields)) {
        // even this with returning * may not always work if transformed...
        // we can have a transformed flag to see if it should be returned?
        this.row = await editRow(queryer, options, "RETURNING *");
      } else {
        // @ts-ignore
        this.row = this.existingEnt["data"];
      }
    } else {
      this.row = await createRow(queryer, options, "RETURNING *");
    }
  }

  private reloadRow(queryer: SyncQueryer, id: ID, options: EditNodeOptions<T>) {
    // TODO this isn't always an ObjectLoader. should throw or figure out a way to get query
    // and run this on its own...
    const loader = this.options.loadEntOptions.loaderFactory.createLoader(
      options.context,
    ) as ObjectLoader<T>;
    const opts = loader.getOptions();
    let cls = clause.Eq(options.key, id);
    if (opts.clause) {
      let optionClause: clause.Clause | undefined;
      if (typeof opts.clause === "function") {
        optionClause = opts.clause();
      } else {
        optionClause = opts.clause;
      }
      if (optionClause) {
        cls = clause.And(optionClause, cls);
      }
    }

    const query = buildQuery({
      fields: opts.fields.length ? opts.fields : ["*"],
      tableName: options.tableName,
      clause: cls,
    });
    // special case log here because we're not going through any of the normal
    // methods here because those are async and this is sync
    // this is the only place we're doing this so only handling here
    logQuery(query, [id]);
    const r = queryer.querySync(query, [id]);
    if (r.rows.length === 1) {
      this.row = r.rows[0];
    }
  }

  performWriteSync(queryer: SyncQueryer, context?: Context): void {
    let options = {
      ...this.options,
      context,
    };
    if (this.existingEnt) {
      if (this.hasData(this.options.fields)) {
        editRowSync(queryer, options, "RETURNING *");
        this.reloadRow(queryer, this.existingEnt.id, options);
      } else {
        // @ts-ignore
        this.row = this.existingEnt["data"];
      }
    } else {
      createRowSync(queryer, options, "RETURNING *");
      const id = options.fields[options.key];
      this.reloadRow(queryer, id, options);
    }
  }

  returnedRow(): Data | null {
    return this.row;
  }

  createdEnt(viewer: Viewer): T | null {
    if (!this.row) {
      return null;
    }
    return new this.options.loadEntOptions.ent(viewer, this.row);
  }
}

interface EdgeOperationOptions {
  operation: WriteOperation;
  id1Placeholder?: boolean;
  id2Placeholder?: boolean;
  dataPlaceholder?: boolean;
}

let globalSchema: GlobalSchema | undefined;
export function setGlobalSchema(val: GlobalSchema) {
  globalSchema = val;
}

export function clearGlobalSchema() {
  globalSchema = undefined;
}

export class EdgeOperation implements DataOperation {
  private edgeData: AssocEdgeData | undefined;
  private constructor(
    private builder: Builder<any>,
    public edgeInput: AssocEdgeInput,
    private options: EdgeOperationOptions,
  ) {}

  async preFetch(queryer: Queryer, context?: Context): Promise<void> {
    let edgeData = await loadEdgeData(this.edgeInput.edgeType);
    if (!edgeData) {
      throw new Error(`error loading edge data for ${this.edgeInput.edgeType}`);
    }
    this.edgeData = edgeData;
  }

  async performWrite(queryer: Queryer, context?: Context): Promise<void> {
    if (!this.edgeData) {
      throw new Error(
        `error fetching edgeData for type ${this.edgeInput.edgeType}`,
      );
    }
    switch (this.options.operation) {
      case WriteOperation.Delete:
        return this.performDeleteWrite(
          queryer,
          this.edgeData,
          this.edgeInput,
          context,
        );
      case WriteOperation.Insert:
      case WriteOperation.Edit:
        return this.performInsertWrite(
          queryer,
          this.edgeData,
          this.edgeInput,
          context,
        );
    }
  }

  performWriteSync(queryer: SyncQueryer, context?: Context): void {
    if (!this.edgeData) {
      throw new Error(
        `error fetching edgeData for type ${this.edgeInput.edgeType}`,
      );
    }
    switch (this.options.operation) {
      case WriteOperation.Delete:
        return this.performDeleteWriteSync(
          queryer,
          this.edgeData,
          this.edgeInput,
          context,
        );
      case WriteOperation.Insert:
      case WriteOperation.Edit:
        return this.performInsertWriteSync(
          queryer,
          this.edgeData,
          this.edgeInput,
          context,
        );
    }
  }

  private getDeleteRowParams(
    edgeData: AssocEdgeData,
    edge: AssocEdgeInput,
    context?: Context,
  ) {
    // TODO need different types for edge than what we use for object data...
    let transformed: TransformedUpdateOperation<any> | null = null;
    let op = SQLStatementOperation.Delete;
    let updateData: Data | null = null;

    // TODO respect disableTransformations
    if (globalSchema?.transformEdgeWrite) {
      const m = new Map();
      for (const k in edge) {
        m.set(k, edge[k]);
      }
      transformed = globalSchema.transformEdgeWrite({
        builder: this.builder,
        input: edge,
        data: m,
        op: SQLStatementOperation.Delete,
      });
      if (transformed) {
        op = transformed.op;
        if (transformed.op === SQLStatementOperation.Insert) {
          throw new Error(`cannot currently transform a delete into an insert`);
        }
        if (transformed.op === SQLStatementOperation.Update) {
          if (!transformed.data) {
            throw new Error(
              `cannot transform a delete into an update without providing data`,
            );
          }
          updateData = transformed.data;
        }
      }
    }

    return {
      op,
      updateData,
      options: {
        tableName: edgeData.edgeTable,
        context,
      },
      clause: clause.And(
        clause.Eq("id1", edge.id1),
        clause.Eq("id2", edge.id2),
        clause.Eq("edge_type", edge.edgeType),
      ),
    };
  }

  private async performDeleteWrite(
    q: Queryer,
    edgeData: AssocEdgeData,
    edge: AssocEdgeInput,
    context?: Context,
  ): Promise<void> {
    const params = this.getDeleteRowParams(edgeData, edge, context);
    if (params.op === SQLStatementOperation.Delete) {
      return deleteRows(q, params.options, params.clause);
    } else {
      if (params.op !== SQLStatementOperation.Update) {
        throw new Error(`invalid operation ${params.op}`);
      }
      await editRow(q, {
        tableName: params.options.tableName,
        whereClause: params.clause,
        fields: params.updateData!,
      });
    }
  }

  private performDeleteWriteSync(
    q: SyncQueryer,
    edgeData: AssocEdgeData,
    edge: AssocEdgeInput,
    context?: Context,
  ): void {
    const params = this.getDeleteRowParams(edgeData, edge, context);
    if (params.op === SQLStatementOperation.Delete) {
      return deleteRowsSync(q, params.options, params.clause);
    } else {
      if (params.op !== SQLStatementOperation.Update) {
        throw new Error(`invalid operation ${params.op}`);
      }
      editRowSync(q, {
        tableName: params.options.tableName,
        whereClause: params.clause,
        fields: params.updateData!,
      });
    }
  }

  private getInsertRowParams(
    edgeData: AssocEdgeData,
    edge: AssocEdgeInput,
    context?: Context,
  ): [CreateRowOptions, string] {
    const fields: Data = {
      id1: edge.id1,
      id2: edge.id2,
      id1_type: edge.id1Type,
      id2_type: edge.id2Type,
      edge_type: edge.edgeType,
      data: edge.data || null,
    };
    if (edge.time) {
      fields["time"] = edge.time.toISOString();
    } else {
      // todo make this a schema field like what we do in generated base files...
      // maybe when actions exist?
      fields["time"] = new Date().toISOString();
    }

    if (globalSchema?.extraEdgeFields) {
      for (const name in globalSchema.extraEdgeFields) {
        const f = globalSchema.extraEdgeFields[name];
        if (f.defaultValueOnCreate) {
          const storageKey = getStorageKey(f, name);
          fields[storageKey] = f.defaultValueOnCreate(this.builder, {});
        }
      }
    }

    // TODO respect disableTransformations

    // TODO need different types for edge than what we use for object data...
    let transformed: TransformedUpdateOperation<any> | null = null;
    if (globalSchema?.transformEdgeWrite) {
      const m = new Map();
      for (const k in fields) {
        m.set(k, fields[k]);
      }
      transformed = globalSchema.transformEdgeWrite({
        builder: this.builder,
        input: fields,
        data: m,
        op: SQLStatementOperation.Insert,
      });
      if (transformed) {
        throw new Error(`transforming an insert edge not currently supported`);
      }
    }

    return [
      {
        tableName: edgeData.edgeTable,
        fields: fields,
        fieldsToLog: fields,
        context,
      },
      "ON CONFLICT(id1, edge_type, id2) DO UPDATE SET data = EXCLUDED.data",
    ];
  }

  private async performInsertWrite(
    q: Queryer,
    edgeData: AssocEdgeData,
    edge: AssocEdgeInput,
    context?: Context,
  ): Promise<void> {
    const [options, suffix] = this.getInsertRowParams(edgeData, edge, context);

    await createRow(q, options, suffix);
  }

  private performInsertWriteSync(
    q: SyncQueryer,
    edgeData: AssocEdgeData,
    edge: AssocEdgeInput,
    context?: Context,
  ): void {
    const [options, suffix] = this.getInsertRowParams(edgeData, edge, context);

    createRowSync(q, options, suffix);
  }

  private resolveImpl(
    executor: Executor,
    placeholder: ID,
    desc: string,
  ): [ID, string] {
    let ent = executor.resolveValue(placeholder);
    if (!ent) {
      throw new Error(
        `could not resolve placeholder value ${placeholder} for ${desc} for edge ${this.edgeInput.edgeType}`,
      );
    }
    if (ent.id === undefined) {
      throw new Error(`id of resolved ent is not defined`);
    }
    return [ent.id, ent.nodeType];
  }

  resolve(executor: Executor): void {
    if (this.options.id1Placeholder) {
      [this.edgeInput.id1, this.edgeInput.id1Type] = this.resolveImpl(
        executor,
        this.edgeInput.id1,
        "id1",
      );
    }
    if (this.options.id2Placeholder) {
      [this.edgeInput.id2, this.edgeInput.id2Type] = this.resolveImpl(
        executor,
        this.edgeInput.id2,
        "id2",
      );
    }
    if (this.options.dataPlaceholder) {
      if (!this.edgeInput.data) {
        throw new Error(`data placeholder set but edgeInput data undefined`);
      }
      let [data, _] = this.resolveImpl(
        executor,
        this.edgeInput.data.toString(),
        "data",
      );
      this.edgeInput.data = data.toString();
    }
  }

  symmetricEdge(): EdgeOperation {
    return new EdgeOperation(
      this.builder,
      {
        id1: this.edgeInput.id2,
        id1Type: this.edgeInput.id2Type,
        id2: this.edgeInput.id1,
        id2Type: this.edgeInput.id1Type,
        edgeType: this.edgeInput.edgeType,
        time: this.edgeInput.time,
        data: this.edgeInput.data,
      },
      {
        operation: this.options.operation,
        id1Placeholder: this.options.id2Placeholder,
        id2Placeholder: this.options.id1Placeholder,
        dataPlaceholder: this.options.dataPlaceholder,
      },
    );
  }

  inverseEdge(edgeData: AssocEdgeData): EdgeOperation {
    return new EdgeOperation(
      this.builder,
      {
        id1: this.edgeInput.id2,
        id1Type: this.edgeInput.id2Type,
        id2: this.edgeInput.id1,
        id2Type: this.edgeInput.id1Type,
        edgeType: edgeData.inverseEdgeType!,
        time: this.edgeInput.time,
        data: this.edgeInput.data,
      },
      {
        operation: this.options.operation,
        id1Placeholder: this.options.id2Placeholder,
        id2Placeholder: this.options.id1Placeholder,
        dataPlaceholder: this.options.dataPlaceholder,
      },
    );
  }

  private static resolveIDs<T extends Ent, T2 extends Ent>(
    srcBuilder: Builder<T>, // id1
    destID: Builder<T2> | ID, // id2 ( and then you flip it)
  ): [ID, string, boolean, ID, boolean] {
    let destIDVal: ID;
    let destPlaceholder = false;
    if (this.isBuilder(destID)) {
      destIDVal = destID.placeholderID;
      destPlaceholder = true;
    } else {
      destIDVal = destID;
    }
    let srcIDVal: ID;
    let srcType: string;

    let srcPlaceholder = false;
    if (srcBuilder.existingEnt) {
      srcIDVal = srcBuilder.existingEnt.id;
      srcType = srcBuilder.existingEnt.nodeType;
    } else {
      srcPlaceholder = true;
      // get placeholder.
      srcIDVal = srcBuilder.placeholderID;
      // expected to be filled later
      srcType = "";
    }

    return [srcIDVal, srcType, srcPlaceholder, destIDVal, destPlaceholder];
  }

  private static isBuilder(val: Builder<Ent> | any): val is Builder<Ent> {
    return (val as Builder<Ent>).placeholderID !== undefined;
  }

  private static resolveData(
    data?: Builder<Ent> | string,
  ): [string | undefined, boolean] {
    if (!data) {
      return [undefined, false];
    }

    if (this.isBuilder(data)) {
      return [data.placeholderID.toString(), true];
    }

    return [data, false];
  }

  static inboundEdge<T extends Ent, T2 extends Ent>(
    builder: Builder<T>,
    edgeType: string,
    id1: Builder<T2> | ID,
    nodeType: string,
    options?: AssocEdgeInputOptions,
  ): EdgeOperation {
    let [id2Val, id2Type, id2Placeholder, id1Val, id1Placeholder] =
      EdgeOperation.resolveIDs(builder, id1);
    let [data, dataPlaceholder] = EdgeOperation.resolveData(options?.data);
    const edge: AssocEdgeInput = {
      id1: id1Val,
      edgeType: edgeType,
      id2: id2Val,
      id2Type: id2Type,
      id1Type: nodeType,
      ...options,
    };
    if (data) {
      edge.data = data;
    }

    return new EdgeOperation(builder, edge, {
      operation: WriteOperation.Insert,
      id2Placeholder,
      id1Placeholder,
      dataPlaceholder,
    });
  }

  static outboundEdge<T extends Ent, T2 extends Ent>(
    builder: Builder<T>,
    edgeType: string,
    id2: Builder<T2> | ID,
    nodeType: string,
    options?: AssocEdgeInputOptions,
  ): EdgeOperation {
    let [id1Val, id1Type, id1Placeholder, id2Val, id2Placeholder] =
      EdgeOperation.resolveIDs(builder, id2);
    let [data, dataPlaceholder] = EdgeOperation.resolveData(options?.data);

    const edge: AssocEdgeInput = {
      id1: id1Val,
      edgeType: edgeType,
      id2: id2Val,
      id2Type: nodeType,
      id1Type: id1Type,
      ...options,
    };
    if (data) {
      edge.data = data;
    }

    return new EdgeOperation(builder, edge, {
      operation: WriteOperation.Insert,
      id1Placeholder,
      id2Placeholder,
      dataPlaceholder,
    });
  }

  static removeInboundEdge<T extends Ent>(
    builder: Builder<T>,
    edgeType: string,
    id1: ID,
  ): EdgeOperation {
    if (!builder.existingEnt) {
      throw new Error("cannot remove an edge from a non-existing ent");
    }
    const edge: AssocEdgeInput = {
      id1: id1,
      edgeType: edgeType,
      id2: builder.existingEnt!.id,
      id2Type: "", // these 2 shouldn't matter
      id1Type: "",
    };
    return new EdgeOperation(builder, edge, {
      operation: WriteOperation.Delete,
    });
  }

  static removeOutboundEdge<T extends Ent>(
    builder: Builder<T>,
    edgeType: string,
    id2: ID,
  ): EdgeOperation {
    if (!builder.existingEnt) {
      throw new Error("cannot remove an edge from a non-existing ent");
    }
    const edge: AssocEdgeInput = {
      id2: id2,
      edgeType: edgeType,
      id1: builder.existingEnt!.id,
      id2Type: "", // these 2 shouldn't matter
      id1Type: "",
    };
    return new EdgeOperation(builder, edge, {
      operation: WriteOperation.Delete,
    });
  }
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
  try {
    let res: QueryResult<QueryResultRow>;
    if (isSyncQueryer(queryer)) {
      res = queryer.execSync(query, values);
    } else {
      res = await queryer.exec(query, values);
    }
    if (cache) {
      cache.clearCache();
    }
    return res;
  } catch (err) {
    // TODO:::why is this not rethrowing?
    log("error", err);
    throw err;
  }
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
  } catch (err) {
    // TODO:::why is this not rethrowing?
    log("error", err);
    throw err;
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
  if (suffix) {
    query = query + " " + suffix;
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

  let idx = 1;
  for (const key in options.fields) {
    const val = options.fields[key];
    values.push(val);
    if (options.fieldsToLog) {
      logValues.push(options.fieldsToLog[key]);
    }
    valsString.push(clause.Eq(key, val).clause(idx));
    idx++;
  }

  const vals = valsString.join(", ");

  let query = `UPDATE ${options.tableName} SET ${vals} WHERE `;

  query = query + options.whereClause.clause(idx);
  values.push(...options.whereClause.values());

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

export class DeleteNodeOperation implements DataOperation {
  constructor(private id: ID, private options: DataOptions) {}

  async performWrite(queryer: Queryer, context?: Context): Promise<void> {
    let options = {
      ...this.options,
      context,
    };
    return deleteRows(queryer, options, clause.Eq("id", this.id));
  }

  performWriteSync(queryer: SyncQueryer, context?: Context): void {
    let options = {
      ...this.options,
      context,
    };
    return deleteRowsSync(queryer, options, clause.Eq("id", this.id));
  }
}

export class AssocEdge {
  id1: ID;
  id1Type: string;
  edgeType: string;
  id2: ID;
  id2Type: string;
  time: Date;
  data?: string | null;

  constructor(data: Data) {
    this.id1 = data.id1;
    this.id1Type = data.id1_type;
    this.id2 = data.id2;
    this.id2Type = data.id2_type;
    this.edgeType = data.edge_type;
    this.time = data.time;
    this.data = data.data;
  }

  getCursor(): string {
    return getCursor({
      row: this,
      col: "time",
      conv: (t) => {
        if (typeof t === "string") {
          return Date.parse(t);
        }
        return t.getTime();
      },
    });
  }
}

interface cursorOptions {
  row: Data;
  col: string;
  cursorKey?: string; // used by tests. if cursor is from one column but the key in the name is different e.g. time for assocs and created_at when taken from the object
  conv?: (any: any) => any;
}

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

export interface AssocEdgeInputOptions {
  time?: Date;
  data?: string | Builder<Ent>;
}

export interface AssocEdgeInput extends AssocEdgeInputOptions {
  id1: ID;
  id1Type: string;
  edgeType: string;
  id2: ID;
  id2Type: string;
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

export const assocEdgeLoader = createDataLoader({
  tableName: "assoc_edge_config",
  fields: assocEdgeFields,
  key: "edge_type",
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
    if (row instanceof Error) {
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
  disableTransformations?: boolean;
}

interface loadCustomEdgesOptions<T extends AssocEdge> extends loadEdgesOptions {
  ctr: AssocEdgeConstructor<T>;
}

export const DefaultLimit = 1000;

// TODO default limit from somewhere
export function defaultEdgeQueryOptions(
  id1: ID,
  edgeType: string,
): EdgeQueryableDataOptions {
  return {
    clause: clause.And(clause.Eq("id1", id1), clause.Eq("edge_type", edgeType)),
    orderby: "time DESC",
    limit: DefaultLimit,
  };
}

export async function loadEdges(
  options: loadEdgesOptions,
): Promise<AssocEdge[]> {
  return loadCustomEdges({ ...options, ctr: AssocEdge });
}

export async function loadCustomEdges<T extends AssocEdge>(
  options: loadCustomEdgesOptions<T>,
): Promise<T[]> {
  const { id1, edgeType, context } = options;
  const edgeData = await loadEdgeData(edgeType);
  if (!edgeData) {
    throw new Error(`error loading edge data for ${edgeType}`);
  }

  const defaultOptions = defaultEdgeQueryOptions(id1, edgeType);
  let cls = defaultOptions.clause!;
  if (options.queryOptions?.clause) {
    cls = clause.And(cls, options.queryOptions.clause);
  }
  let fields = edgeFields;

  if (globalSchema?.transformEdgeRead) {
    const transformClause = globalSchema.transformEdgeRead();
    if (!options.disableTransformations) {
      cls = clause.And(cls, transformClause);
    }
    fields = edgeFields.concat(transformClause.columns());
  }

  const rows = await loadRows({
    tableName: edgeData.edgeTable,
    fields: fields,
    clause: cls,
    orderby: options.queryOptions?.orderby || defaultOptions.orderby,
    limit: options.queryOptions?.limit || defaultOptions.limit,
    context,
  });
  return rows.map((row) => {
    return new options.ctr(row);
  });
}

export async function loadUniqueEdge(
  options: loadEdgesOptions,
): Promise<AssocEdge | null> {
  const { id1, edgeType, context } = options;

  const edgeData = await loadEdgeData(edgeType);
  if (!edgeData) {
    throw new Error(`error loading edge data for ${edgeType}`);
  }
  const row = await loadRow({
    tableName: edgeData.edgeTable,
    fields: edgeFields,
    clause: clause.And(clause.Eq("id1", id1), clause.Eq("edge_type", edgeType)),
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
  return await loadEnt(viewer, edge.id2, options);
}

export async function loadRawEdgeCountX(
  options: loadEdgesOptions,
): Promise<number> {
  const { id1, edgeType, context } = options;
  const edgeData = await loadEdgeData(edgeType);
  if (!edgeData) {
    throw new Error(`error loading edge data for ${edgeType}`);
  }

  const row = await loadRowX({
    tableName: edgeData.edgeTable,
    // sqlite needs as count otherwise it returns count(1)
    fields: ["count(1) as count"],
    clause: clause.And(clause.Eq("id1", id1), clause.Eq("edge_type", edgeType)),
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
  // TODO at some point, same as in go, we can be smart about this and have heuristics to determine if we fetch everything here or not
  // we're assuming a cache here but not always true and this can be expensive if not...
  const edges = await loadCustomEdges(options);
  return edges.find((edge) => edge.id2 == options.id2);
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
  row: Data | null,
): Promise<TEnt | null> {
  if (!row) {
    return null;
  }
  const ent = new options.ent(viewer, row);
  return await applyPrivacyPolicyForEnt(viewer, ent, row, options);
}

export async function applyPrivacyPolicyForRowX<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
>(
  viewer: TViewer,
  options: LoadEntOptions<TEnt, TViewer>,
  row: Data,
): Promise<TEnt> {
  const ent = new options.ent(viewer, row);
  return await applyPrivacyPolicyForEntX(viewer, ent, row, options);
}

export async function applyPrivacyPolicyForRows<
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

async function loadEdgeWithConst<T extends string>(
  viewer: Viewer,
  id1: ID,
  id2: ID,
  edgeEnum: T,
  edgeType: string,
): Promise<[T, AssocEdge | undefined]> {
  const edge = await loadEdgeForID2({
    id1: id1,
    id2: id2,
    edgeType: edgeType,
    context: viewer.context,
    ctr: AssocEdge,
  });
  return [edgeEnum, edge];
}

// given a viewer, an id pair, and a map of edgeEnum to EdgeType
// return the edgeEnum that's set in the group
export async function getEdgeTypeInGroup<T extends string>(
  viewer: Viewer,
  id1: ID,
  id2: ID,
  m: Map<T, string>,
): Promise<[T, AssocEdge] | undefined> {
  let promises: Promise<[T, AssocEdge | undefined]>[] = [];
  for (const [k, v] of m) {
    promises.push(loadEdgeWithConst(viewer, id1, id2, k, v));
  }
  const results = await Promise.all(promises);
  for (const res of results) {
    if (res[1]) {
      return [res[0], res[1]];
    }
  }
}
