import DB from "./db";
import {
  QueryArrayConfig,
  Submittable,
  QueryArrayResult,
  QueryResultRow,
  QueryConfig,
  QueryResult,
} from "pg";
import {
  EntPrivacyError,
  applyPrivacyPolicy,
  applyPrivacyPolicyX,
  PrivacyPolicy,
} from "./privacy";
import { Executor } from "./action";
import DataLoader from "dataloader";

// TODO move Viewer and context into viewer.ts or something
import { Context } from "./auth/context";

import * as query from "./query";
import { WriteOperation, Builder } from "./action";

export interface Viewer {
  viewerID: ID | null;
  viewer: () => Promise<Ent | null>;
  instanceKey: () => string;
  isOmniscient?(): boolean; // optional function to indicate a viewer that can see anything e.g. admin
  // TODO determine if we want this here.
  // just helpful to have it here
  // not providing a default AllowIfOmniRule

  // where should dataloaders be put?
  // I want dataloaders to be created on demand as needed
  // so it seems having it in Context (per-request info makes sense)
  // so does that mean we should pass Context all the way down and not Viewer?
  context?: Context;
}

export interface Ent {
  id: ID;
  viewer: Viewer;
  privacyPolicy: PrivacyPolicy;
  nodeType: string;
}

export interface EntConstructor<T extends Ent> {
  new (viewer: Viewer, id: ID, options: {}): T;
}

export type ID = string | number;

interface DataOptions {
  // TODO pool or client later since we should get it from there
  // TODO this can be passed in for scenarios where we are not using default configuration
  //  clientConfig?: ClientConfig;
  tableName: string;
  context?: Context;
}

export interface SelectDataOptions extends DataOptions {
  // list of fields to read
  fields: string[];
  pkey?: string; // what key are we loading from. if not provided we're loading from column "id"
}

export interface QueryableDataOptions extends SelectDataOptions {
  clause: query.Clause;
  orderby?: string; // this technically doesn't make sense when querying just one row but whatevs
}

// For loading data from database
export interface LoadRowOptions extends QueryableDataOptions {
  //  pkey?: string; // what key are we loading from. if not provided we're loading from column "id"
}

interface LoadRowsOptions extends QueryableDataOptions {}

export interface EditRowOptions extends DataOptions {
  // fields to be edited
  fields: {};
  pkey?: string; // what key are we loading from. if not provided we're loading from column "id"
}

interface LoadableEntOptions<T extends Ent> extends DataOptions {
  ent: EntConstructor<T>;
}

// information needed to load an ent from the databse
// always id for now...
export interface LoadEntOptions<T extends Ent>
  extends LoadableEntOptions<T>,
    SelectDataOptions {}

// information needed to edit an ent
export interface EditEntOptions<T extends Ent>
  extends LoadableEntOptions<T>,
    EditRowOptions {}

// Ent accessors
export async function loadEnt<T extends Ent>(
  viewer: Viewer,
  id: ID,
  options: LoadEntOptions<T>,
): Promise<T | null> {
  const l = viewer.context?.cache?.getEntLoader(options);
  if (!l) {
    const col = options.pkey || "id";
    return loadEntFromClause(viewer, options, query.Eq(col, id));
  }
  const row = await l.load(id);
  return await applyPrivacyPolicyForRow(viewer, options, row);
}

export async function loadEntFromClause<T extends Ent>(
  viewer: Viewer,
  options: LoadEntOptions<T>,
  clause: query.Clause,
): Promise<T | null> {
  const rowOptions: LoadRowOptions = {
    ...options,
    clause: clause,
    context: viewer.context,
  };
  const row = await loadRow(rowOptions);
  return await applyPrivacyPolicyForRow(viewer, options, row);
}

export async function loadEntX<T extends Ent>(
  viewer: Viewer,
  id: ID,
  options: LoadEntOptions<T>,
): Promise<T> {
  const l = viewer.context?.cache?.getEntLoader(options);
  if (!l) {
    const col = options.pkey || "id";
    return loadEntXFromClause(viewer, options, query.Eq(col, id));
  }
  const row = await l.load(id);
  if (!row) {
    throw new Error(`couldn't find row for id ${id}`);
  }
  return await applyPrivacyPolicyForRowX(viewer, options, row);
}

// same as loadEntFromClause
export async function loadEntXFromClause<T extends Ent>(
  viewer: Viewer,
  options: LoadEntOptions<T>,
  clause: query.Clause,
): Promise<T> {
  const rowOptions: LoadRowOptions = {
    ...options,
    clause: clause,
    context: viewer.context,
  };
  const row = await loadRowX(rowOptions);
  const col = options.pkey || "id";
  const ent = new options.ent(viewer, row[col], row);
  return await applyPrivacyPolicyForEntX(viewer, ent);
}

export async function loadEnts<T extends Ent>(
  viewer: Viewer,
  options: LoadEntOptions<T>,
  ...ids: ID[]
): Promise<T[]> {
  if (!ids.length) {
    return [];
  }
  const l = viewer.context?.cache?.getEntLoader(options);
  let m: Map<ID, T> = new Map();

  // TODO do we want this loader check all over the place?
  if (l) {
    const rows = await l.loadMany(ids);
    m = await applyPrivacyPolicyForRows(viewer, rows, options);
  } else {
    const col = options.pkey || "id";
    m = await loadEntsFromClause(viewer, query.In(col, ...ids), options);
  }

  // TODO do we want to change this to be a map not a list so that it's easy to check for existence?
  // TODO eventually this should be doing a cache then db queyr and maybe depend on dataloader to get all the results at once

  // we need to get the result and re-sort... because the raw db access doesn't guarantee it in same order
  // apparently
  //  let m = await loadEntsFromClause(viewer, query.In("id", ...ids), options);
  let result: T[] = [];
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
export async function loadEntsFromClause<T extends Ent>(
  viewer: Viewer,
  clause: query.Clause,
  options: LoadEntOptions<T>,
): Promise<Map<ID, T>> {
  const rowOptions: LoadRowOptions = {
    ...options,
    clause: clause,
    context: viewer.context,
  };

  const rows = await loadRows(rowOptions);
  return await applyPrivacyPolicyForRows(viewer, rows, options);
}

// Derived ents
export async function loadDerivedEnt<T extends Ent>(
  viewer: Viewer,
  data: {},
  loader: new (viewer: Viewer, data: {}) => T,
): Promise<T | null> {
  const ent = new loader(viewer, data);
  return await applyPrivacyPolicyForEnt(viewer, ent);
}

export async function loadDerivedEntX<T extends Ent>(
  viewer: Viewer,
  data: {},
  loader: new (viewer: Viewer, data: {}) => T,
): Promise<T> {
  const ent = new loader(viewer, data);
  return await applyPrivacyPolicyForEntX(viewer, ent);
}

// ent based data-loader
export function createDataLoader(options: SelectDataOptions) {
  return new DataLoader(async (ids: ID[]) => {
    if (!ids.length) {
      return [];
    }
    let col = options.pkey || "id";
    const clause = query.In(col, ...ids);
    const rowOptions: LoadRowOptions = {
      ...options,
      clause: clause,
    };

    // TODO is there a better way of doing this?
    // context not needed because we're creating a loader which has its own cache which is being used here
    const nodes = await loadRows(rowOptions);
    let result: {}[] = [];
    ids.forEach((id) => {
      for (const node of nodes) {
        if (node[col] === id) {
          result.push(node);
          return;
        }
      }
      return null;
    });

    return result;
  });
}

export async function applyPrivacyPolicyForEnt<T extends Ent>(
  viewer: Viewer,
  ent: T | null,
): Promise<T | null> {
  if (ent) {
    const visible = await applyPrivacyPolicy(viewer, ent.privacyPolicy, ent);
    if (visible) {
      return ent;
    }
  }
  return null;
}

export async function applyPrivacyPolicyForEntX<T extends Ent>(
  viewer: Viewer,
  ent: T,
): Promise<T> {
  const visible = await applyPrivacyPolicyX(viewer, ent.privacyPolicy, ent);
  if (visible) {
    return ent;
  }
  throw new EntPrivacyError(ent.privacyPolicy, ent.id);
}

function logQuery(query: string, values: any[]) {
  // console.log(query);
  // console.log(values);
  // console.trace();
}

export async function loadRowX(options: LoadRowOptions): Promise<{}> {
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

export async function loadRow(options: LoadRowOptions): Promise<{} | null> {
  let cache = options.context?.cache;
  if (cache) {
    let row = cache.getCachedRow(options);
    if (row !== null) {
      return row;
    }
  }

  const pool = DB.getInstance().getPool();

  const query = buildQuery(options);
  const values = options.clause.values();
  logQuery(query, values);
  try {
    const res = await pool.query(query, values);
    if (res.rowCount != 1) {
      if (res.rowCount > 1) {
        console.error("got more than one row for query " + query);
      }
      return null;
    }

    // put the row in the cache...
    if (cache) {
      cache.primeCache(options, res.rows[0]);
    }

    return res.rows[0];
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function loadRows(options: LoadRowsOptions): Promise<{}[]> {
  let cache = options.context?.cache;
  if (cache) {
    let rows = cache.getCachedRows(options);
    if (rows !== null) {
      return rows;
    }
  }

  const pool = DB.getInstance().getPool();

  // always start at 1
  const values = options.clause.values();
  const query = buildQuery(options);

  logQuery(query, values);
  try {
    const res = await pool.query(query, values);
    // put the rows in the cache...
    if (cache) {
      cache.primeCache(options, res.rows);
    }
    return res.rows;
  } catch (e) {
    // TODO need to change every query to catch an error!
    console.error(e);
    return [];
  }
}

export function buildQuery(options: QueryableDataOptions): string {
  const fields = options.fields.join(", ");
  // always start at 1
  const whereClause = options.clause.clause(1);
  let query = `SELECT ${fields} FROM ${options.tableName} WHERE ${whereClause}`;
  if (options.orderby) {
    query = `${query} ORDER BY ${options.orderby} `;
  }
  return query;
}

// slew of methods taken from pg
export interface Queryer {
  query<T extends Submittable>(queryStream: T): T;
  // tslint:disable:no-unnecessary-generics
  query<R extends any[] = any[], I extends any[] = any[]>(
    queryConfig: QueryArrayConfig<I>,
    values?: I,
  ): Promise<QueryArrayResult<R>>;
  query<R extends QueryResultRow = any, I extends any[] = any[]>(
    queryConfig: QueryConfig<I>,
  ): Promise<QueryResult<R>>;
  query<R extends QueryResultRow = any, I extends any[] = any[]>(
    queryTextOrConfig: string | QueryConfig<I>,
    values?: I,
  ): Promise<QueryResult<R>>;
  query<R extends any[] = any[], I extends any[] = any[]>(
    queryConfig: QueryArrayConfig<I>,
    callback: (err: Error, result: QueryArrayResult<R>) => void,
  ): void;
  query<R extends QueryResultRow = any, I extends any[] = any[]>(
    queryTextOrConfig: string | QueryConfig<I>,
    callback: (err: Error, result: QueryResult<R>) => void,
  ): void;
  query<R extends QueryResultRow = any, I extends any[] = any[]>(
    queryText: string,
    values: I,
    callback: (err: Error, result: QueryResult<R>) => void,
  ): void;
  // tslint:enable:no-unnecessary-generics
}

export interface DataOperation {
  performWrite(queryer: Queryer, context?: Context): Promise<void>;
  returnedEntRow?(): {} | null; // optional to indicate the row that was created
  resolve?<T extends Ent>(executor: Executor<T>): void; //throws?
}

export interface EditNodeOptions extends EditRowOptions {
  fieldsToResolve: string[];
}

export class EditNodeOperation implements DataOperation {
  row: {} | null;

  constructor(
    public options: EditNodeOptions,
    private existingEnt: Ent | null = null,
  ) {}

  resolve<T extends Ent>(executor: Executor<T>): void {
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
          `couldn't resolve field ${fieldName} with value ${value.placeholderID}`,
        );
      }
      fields[fieldName] = ent.id;
    });
    this.options.fields = fields;
  }

  async performWrite(queryer: Queryer, context?: Context): Promise<void> {
    let options = {
      ...this.options,
      context,
    };
    if (this.existingEnt) {
      this.row = await editRow(queryer, options, this.existingEnt.id);
    } else {
      this.row = await createRow(queryer, options, "RETURNING *");
    }
  }

  returnedEntRow(): {} | null {
    return this.row;
  }
}

interface EdgeOperationOptions {
  operation: WriteOperation;
  id1Placeholder?: boolean;
  id2Placeholder?: boolean;
}

export class EdgeOperation implements DataOperation {
  private constructor(
    public edgeInput: AssocEdgeInput,
    private options: EdgeOperationOptions,
  ) {}

  async performWrite(queryer: Queryer, context?: Context): Promise<void> {
    const edge = this.edgeInput;

    let edgeData = await loadEdgeData(edge.edgeType);
    if (!edgeData) {
      throw new Error(`error loading edge data for ${edge.edgeType}`);
    }

    switch (this.options.operation) {
      case WriteOperation.Delete:
        return this.performDeleteWrite(queryer, edgeData, edge, context);
      case WriteOperation.Insert:
      case WriteOperation.Edit:
        return this.performInsertWrite(queryer, edgeData, edge, context);
    }
  }

  private async performDeleteWrite(
    q: Queryer,
    edgeData: AssocEdgeData,
    edge: AssocEdgeInput,
    context?: Context,
  ): Promise<void> {
    return deleteRow(
      q,
      {
        tableName: edgeData.edgeTable,
        context,
      },
      query.And(
        query.Eq("id1", edge.id1),
        query.Eq("id2", edge.id2),
        query.Eq("edge_type", edge.edgeType),
      ),
    );
  }

  private async performInsertWrite(
    q: Queryer,
    edgeData: AssocEdgeData,
    edge: AssocEdgeInput,
    context?: Context,
  ): Promise<void> {
    const fields = {
      id1: edge.id1,
      id2: edge.id2,
      id1_type: edge.id1Type,
      id2_type: edge.id2Type,
      edge_type: edge.edgeType,
      data: edge.data,
    };
    if (edge.time) {
      fields["time"] = edge.time;
    } else {
      // todo make this a schema field like what we do in generated base files...
      // maybe when actions exist?
      fields["time"] = new Date();
    }
    if (edge.data) {
      fields["data"] = edge.data;
    }

    await createRow(
      q,
      {
        tableName: edgeData.edgeTable,
        fields: fields,
        context,
      },
      "ON CONFLICT(id1, edge_type, id2) DO UPDATE SET data = EXCLUDED.data",
    );
  }

  private resolveImpl<T extends Ent>(
    executor: Executor<T>,
    placeholder: ID,
    desc: string,
  ): [ID, string] {
    let ent = executor.resolveValue(placeholder);
    if (!ent) {
      throw new Error(
        `could not resolve placeholder value ${placeholder} for ${desc} for edge ${this.edgeInput.edgeType}`,
      );
    }
    return [ent.id, ent.nodeType];
  }

  resolve<T extends Ent>(executor: Executor<T>): void {
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
  }

  symmetricEdge(): EdgeOperation {
    return new EdgeOperation(
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
      },
    );
  }

  inverseEdge(edgeData: AssocEdgeData): EdgeOperation {
    return new EdgeOperation(
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
      },
    );
  }

  private static resolveIDs<T extends Ent, T2 extends Ent>(
    srcBuilder: Builder<T>, // id1
    destID: Builder<T2> | ID, // id2 ( and then you flip it)
  ): [ID, string, boolean, ID, boolean] {
    let destIDVal: ID;
    let destPlaceholder = false;
    if (typeof destID === "string" || typeof destID === "number") {
      destIDVal = destID;
    } else {
      destIDVal = destID.placeholderID;
      destPlaceholder = true;
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

  static inboundEdge<T extends Ent, T2 extends Ent>(
    builder: Builder<T>,
    edgeType: string,
    id1: Builder<T2> | ID,
    nodeType: string,
    options?: AssocEdgeInputOptions,
  ): EdgeOperation {
    let [
      id2Val,
      id2Type,
      id2Placeholder,
      id1Val,
      id1Placeholder,
    ] = EdgeOperation.resolveIDs(builder, id1);

    const edge: AssocEdgeInput = {
      id1: id1Val,
      edgeType: edgeType,
      id2: id2Val,
      id2Type: id2Type,
      id1Type: nodeType,
      ...options,
    };

    return new EdgeOperation(edge, {
      operation: WriteOperation.Insert,
      id2Placeholder: id2Placeholder,
      id1Placeholder: id1Placeholder,
    });
  }

  static outboundEdge<T extends Ent, T2 extends Ent>(
    builder: Builder<T>,
    edgeType: string,
    id2: Builder<T2> | ID,
    nodeType: string,
    options?: AssocEdgeInputOptions,
  ): EdgeOperation {
    let [
      id1Val,
      id1Type,
      id1Placeholder,
      id2Val,
      id2Placeholder,
    ] = EdgeOperation.resolveIDs(builder, id2);

    const edge: AssocEdgeInput = {
      id1: id1Val,
      edgeType: edgeType,
      id2: id2Val,
      id2Type: nodeType,
      id1Type: id1Type,
      ...options,
    };

    return new EdgeOperation(edge, {
      operation: WriteOperation.Insert,
      id1Placeholder: id1Placeholder,
      id2Placeholder: id2Placeholder,
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
    return new EdgeOperation(edge, {
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
    return new EdgeOperation(edge, {
      operation: WriteOperation.Delete,
    });
  }
}

async function mutateRow(
  queryer: Queryer,
  query: string,
  values: any[],
  options: DataOptions,
) {
  logQuery(query, values);

  let cache = options.context?.cache;
  try {
    const res = await queryer.query(query, values);
    if (cache) {
      cache.clearCache();
    }
    return res;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// TODO: these three are not to be exported out of this package
// only from this file
export async function createRow(
  queryer: Queryer,
  options: EditRowOptions,
  suffix: string,
): Promise<{} | null> {
  let fields: string[] = [];
  let values: any[] = [];
  let valsString: string[] = [];
  let idx = 1;
  for (const key in options.fields) {
    fields.push(key);
    values.push(options.fields[key]);
    valsString.push(`$${idx}`);
    idx++;
  }

  const cols = fields.join(", ");
  const vals = valsString.join(", ");

  let query = `INSERT INTO ${options.tableName} (${cols}) VALUES (${vals}) ${suffix}`;

  const res = await mutateRow(queryer, query, values, options);

  if (res?.rowCount === 1) {
    return res.rows[0];
  }
  return null;
}

export async function editRow(
  queryer: Queryer,
  options: EditRowOptions,
  id: ID,
): Promise<{} | null> {
  let valsString: string[] = [];
  let values: any[] = [];

  let idx = 1;
  for (const key in options.fields) {
    values.push(options.fields[key]);
    valsString.push(`${key} = $${idx}`);
    idx++;
  }
  values.push(id);

  const vals = valsString.join(", ");
  const col = options.pkey || "id";

  let query = `UPDATE ${options.tableName} SET ${vals} WHERE ${col} = $${idx} RETURNING *`;

  const res = await mutateRow(queryer, query, values, options);

  if (res?.rowCount == 1) {
    // for now assume id primary key
    // TODO make this extensible as needed.
    let row = res.rows[0];
    return row;
  }
  return null;
}

export async function deleteRow(
  queryer: Queryer,
  options: DataOptions,
  clause: query.Clause,
): Promise<void> {
  const query = `DELETE FROM ${options.tableName} WHERE ${clause.clause(1)}`;
  const values = clause.values();
  await mutateRow(queryer, query, values, options);
}

export class DeleteNodeOperation implements DataOperation {
  constructor(private id: ID, private options: DataOptions) {}

  async performWrite(queryer: Queryer, context?: Context): Promise<void> {
    let options = {
      ...this.options,
      context,
    };
    return deleteRow(queryer, options, query.Eq("id", this.id));
  }
}

export class AssocEdge {
  id1: ID;
  id1Type: string;
  edgeType: string;
  id2: ID;
  id2Type: string;
  time?: Date;
  data?: string;

  constructor(data: {}) {
    this.id1 = data["id1"];
    this.id1Type = data["id1_type"];
    this.id2 = data["id2"];
    this.id2Type = data["id2_type"];
    this.edgeType = data["edge_type"];
    this.time = data["time"];
    this.data = data["data"];
  }
}

export interface AssocEdgeInputOptions {
  time?: Date;
  data?: string;
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

  constructor(data: {}) {
    this.edgeType = data["edge_type"];
    this.edgeName = data["edge_name"];
    this.symmetricEdge = data["symmetric_edge"];
    this.inverseEdgeType = data["inverse_edge_type"];
    this.edgeTable = data["edge_table"];
  }
}

const assocEdgeFields = [
  "edge_type",
  "edge_name",
  "symmetric_edge",
  "inverse_edge_type",
  "edge_table",
];

const assocEdgeLoader = createDataLoader({
  tableName: "assoc_edge_config",
  fields: assocEdgeFields,
  pkey: "edge_type",
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
  return new Map(rows.map((row) => [row["edge_type"], new AssocEdgeData(row)]));
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

interface loadEdgesOptions {
  id1: ID;
  edgeType: string;
  context?: Context;
}

export async function loadEdges(
  options: loadEdgesOptions,
): Promise<AssocEdge[]> {
  const { id1, edgeType, context } = options;
  const edgeData = await loadEdgeData(edgeType);
  if (!edgeData) {
    throw new Error(`error loading edge data for ${edgeType}`);
  }
  const rows = await loadRows({
    tableName: edgeData.edgeTable,
    fields: edgeFields,
    clause: query.And(query.Eq("id1", id1), query.Eq("edge_type", edgeType)),
    orderby: "time DESC",
    context,
  });

  let result: AssocEdge[] = [];
  for (const row of rows) {
    result.push(new AssocEdge(row));
  }
  return result;
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
    clause: query.And(query.Eq("id1", id1), query.Eq("edge_type", edgeType)),
    context,
  });
  if (!row) {
    return null;
  }
  return new AssocEdge(row);
}

export async function loadUniqueNode<T extends Ent>(
  viewer: Viewer,
  id1: ID,
  edgeType: string,
  options: LoadEntOptions<T>,
): Promise<T | null> {
  const edge = await loadUniqueEdge({ id1, edgeType, context: viewer.context });
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
    fields: ["count(1)"],
    clause: query.And(query.Eq("id1", id1), query.Eq("edge_type", edgeType)),
    context,
  });
  return parseInt(row["count"], 10);
}

interface loadEdgeForIDOptions extends loadEdgesOptions {
  id2: ID;
}

export async function loadEdgeForID2(
  options: loadEdgeForIDOptions,
): Promise<AssocEdge | undefined> {
  // TODO at some point, same as in go, we can be smart about this and have heuristics to determine if we fetch everything here or not
  // we're assuming a cache here but not always tue and this can be expensive if not...
  const edges = await loadEdges(options);
  return edges.find((edge) => edge.id2 == options.id2);
}

export async function loadNodesByEdge<T extends Ent>(
  viewer: Viewer,
  id1: ID,
  edgeType: string,
  options: LoadEntOptions<T>,
): Promise<T[]> {
  // load edges
  const rows = await loadEdges({ id1, edgeType, context: viewer.context });

  // extract id2s
  const ids = rows.map((row) => row.id2);

  return loadEnts(viewer, options, ...ids);
}

async function applyPrivacyPolicyForRow<T extends Ent>(
  viewer: Viewer,
  options: LoadEntOptions<T>,
  row: {} | null,
): Promise<T | null> {
  if (!row) {
    return null;
  }
  const col = options.pkey || "id";
  const ent = new options.ent(viewer, row[col], row);
  return await applyPrivacyPolicyForEnt(viewer, ent);
}

async function applyPrivacyPolicyForRowX<T extends Ent>(
  viewer: Viewer,
  options: LoadEntOptions<T>,
  row: {},
): Promise<T> {
  const col = options.pkey || "id";

  const ent = new options.ent(viewer, row[col], row);
  return await applyPrivacyPolicyForEntX(viewer, ent);
}

async function applyPrivacyPolicyForRows<T extends Ent>(
  viewer: Viewer,
  rows: {}[],
  options: LoadEntOptions<T>,
) {
  let m: Map<ID, T> = new Map();
  // apply privacy logic
  const ents = await Promise.all(
    rows.map(async (row) => {
      const col = options.pkey || "id";
      const ent = new options.ent(viewer, row[col], row);
      let privacyEnt = await applyPrivacyPolicyForEnt(viewer, ent);
      if (privacyEnt) {
        m.set(row[col], privacyEnt);
      }
    }),
  );
  return m;
}
