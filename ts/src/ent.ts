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

import * as query from "./query";

export interface Viewer {
  viewerID: ID | null;
  viewer: () => Promise<Ent | null>;
  instanceKey: () => string;
  isOmniscient?(): boolean; // optional function to indicate a viewer that can see anything e.g. admin
  // TODO determine if we want this here.
  // just helpful to have it here
  // not providing a default AllowIfOmniRule
}

export interface Ent {
  id: ID;
  viewer: Viewer;
  privacyPolicy: PrivacyPolicy;
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
}

interface SelectDataOptions extends DataOptions {
  // list of fields to read
  fields: string[];
}

// For loading data from database
export interface LoadRowOptions extends SelectDataOptions {
  clause: query.Clause;
  //  pkey?: string; // what key are we loading from. if not provided we're loading from column "id"
}

interface LoadRowsOptions extends SelectDataOptions {
  clause: query.Clause;
  orderby?: string;
}

interface EditRowOptions extends DataOptions {
  // fields to be edited
  fields: {};
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

export async function loadEnt<T extends Ent>(
  viewer: Viewer,
  id: ID,
  options: LoadEntOptions<T>,
): Promise<T | null> {
  return loadEntFromClause(viewer, options, query.Eq("id", id));
}

export async function loadEntFromClause<T extends Ent>(
  viewer: Viewer,
  options: LoadEntOptions<T>,
  clause: query.Clause,
): Promise<T | null> {
  const rowOptions: LoadRowOptions = {
    ...options,
    clause: clause,
  };
  const row = await loadRow(rowOptions);
  if (!row) {
    return null;
  }
  const ent = new options.ent(viewer, row["id"], row);
  return await applyPrivacyPolicyForEnt(viewer, ent);
}

export async function loadEntX<T extends Ent>(
  viewer: Viewer,
  id: ID,
  options: LoadEntOptions<T>,
): Promise<T> {
  return loadEntXFromClause(viewer, options, query.Eq("id", id));
}

export async function loadEntXFromClause<T extends Ent>(
  viewer: Viewer,
  options: LoadEntOptions<T>,
  clause: query.Clause,
): Promise<T> {
  const rowOptions: LoadRowOptions = {
    ...options,
    clause: clause,
  };
  const row = await loadRowX(rowOptions);
  const ent = new options.ent(viewer, row["id"], row);
  return await applyPrivacyPolicyForEntX(viewer, ent);
}

export async function loadEnts<T extends Ent>(
  viewer: Viewer,
  options: LoadEntOptions<T>,
  ...ids: ID[]
): Promise<T[]> {
  return loadEntsFromClause(viewer, query.In("id", ...ids), options);
}

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

async function applyPrivacyPolicyForEnt<T extends Ent>(
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

async function applyPrivacyPolicyForEntX<T extends Ent>(
  viewer: Viewer,
  ent: T,
): Promise<T> {
  const visible = await applyPrivacyPolicyX(viewer, ent.privacyPolicy, ent);
  if (visible) {
    return ent;
  }
  throw new EntPrivacyError(ent.id);
}

function logQuery(query: string, values: any[] = []) {
  // console.log(query);
  // console.log(values);
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
  const pool = DB.getInstance().getPool();
  const fields = options.fields.join(", ");

  // always start at 1
  const whereClause = options.clause.clause(1);
  const values = options.clause.values();
  const query = `SELECT ${fields} FROM ${options.tableName} WHERE ${whereClause}`;
  logQuery(query, values);
  try {
    const res = await pool.query(query, values);
    if (res.rowCount != 1) {
      if (res.rowCount > 1) {
        console.error("got more than one row for query " + query);
      }
      return null;
    }

    return res.rows[0];
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function loadRows(options: LoadRowsOptions): Promise<{}[]> {
  const pool = DB.getInstance().getPool();
  const fields = options.fields.join(", ");

  // always start at 1
  const whereClause = options.clause.clause(1);
  const values = options.clause.values();
  let query = `SELECT ${fields} FROM ${options.tableName} WHERE ${whereClause}`;
  if (options.orderby) {
    query = `${query} ORDER BY ${options.orderby} `;
  }

  logQuery(query, values);
  try {
    const res = await pool.query(query, values);
    return res.rows;
  } catch (e) {
    // TODO need to change every query to catch an error!
    console.error(e);
    return [];
  }
}

export async function createEnt<T extends Ent>(
  viewer: Viewer,
  options: EditEntOptions<T>,
): Promise<T | null> {
  const row = await createRow(options);
  if (!row) {
    return null;
  }
  // for now assume id primary key
  // todo
  return new options.ent(viewer, row["id"], row);
}

// slew of methods taken from pg
interface Queryer {
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

interface DataOperation {
  performWrite(queryer: Queryer): Promise<void>;
}

// this sould get a flag of whether it should throw or not and then do the right thing
// each operation shouldn't throw or do anything with exceptions
async function executeOperations(
  operations: DataOperation[],
  throwErr: boolean = false,
): Promise<void> {
  if (operations.length == 1) {
    const pool = DB.getInstance().getPool();

    return operations[0].performWrite(pool);
  }

  const client = await DB.getInstance().getNewClient();
  try {
    await client.query("BEGIN");
    for (const op of operations) {
      await op.performWrite(client);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    // rethrow the exception to be caught
    if (throwErr) {
      throw e;
    } else {
      console.error(e);
    }
  } finally {
    client.release();
  }
}

class CreateRowOperation implements DataOperation {
  row: {};

  constructor(public options: EditRowOptions, private suffix?: string) {}

  async performWrite(queryer: Queryer): Promise<void> {
    let fields: string[] = [];
    let values: any[] = [];
    let valsString: string[] = [];
    let idx = 1;
    for (const key in this.options.fields) {
      fields.push(key);
      values.push(this.options.fields[key]);
      valsString.push(`$${idx}`);
      idx++;
    }

    const cols = fields.join(", ");
    const vals = valsString.join(", ");

    let query = `INSERT INTO ${this.options.tableName} (${cols}) VALUES (${vals}) RETURNING *`;

    logQuery(query);

    const res = await queryer.query(query, values);

    if (res.rowCount == 1) {
      this.row = res.rows[0];
    }
  }
}

class CreateEdgeOperation extends CreateRowOperation {
  constructor(edge: AssocEdgeInput, edgeData: AssocEdgeData) {
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
    super(
      {
        tableName: edgeData.edgeTable,
        fields: fields,
      },
      // postgres specific suffix. could be handled by sqlbuilder also
      "ON CONFLICT(id1, edge_type, id2) DO UPDATE SET data = EXCLUDED.data",
    );
  }
}

// simple helper function for single create (not in a transaction)
// TODO handle this better when actions etc come up
async function createRow(options: EditRowOptions): Promise<{} | null> {
  const op = new CreateRowOperation(options);
  await executeOperations([op]);
  if (op.row) {
    return op.row;
  }
  return null;
}

// column should be passed in here
export async function editEnt<T extends Ent>(
  viewer: Viewer,
  id: ID,
  options: EditEntOptions<T>,
): Promise<T | null> {
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

  let query = `UPDATE ${options.tableName} SET ${vals} WHERE id = $${idx} RETURNING *`;
  logQuery(query);

  try {
    const pool = DB.getInstance().getPool();
    const res = await pool.query(query, values);

    if (res.rowCount == 1) {
      // for now assume id primary key
      // TODO make this extensible as needed.
      let row = res.rows[0];
      return new options.ent(viewer, row.id, row);
    }
  } catch (e) {
    console.error(e);
    return null;
  }
  return null;
}

// need a deleteRow vs deleteEnt eventually
export async function deleteEnt(
  viewer: Viewer,
  id: ID,
  options: DataOptions,
): Promise<null> {
  let query = `DELETE FROM ${options.tableName} WHERE id = $1`;
  logQuery(query);

  try {
    const pool = DB.getInstance().getPool();
    await pool.query(query, [id]);
  } catch (e) {
    console.error(e);
  }
  return null;
}

enum EditOperation {
  Create = "create",
  Edit = "edit",
  Delete = "delete",
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

export interface AssocEdgeInput {
  id1: ID;
  id1Type: string;
  edgeType: string;
  id2: ID;
  id2Type: string;
  time?: Date;
  data?: string;
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

// writeEdge doesn't throw
export async function writeEdge(edge: AssocEdgeInput): Promise<void> {
  const operations = await edgeOperations(edge);
  await executeOperations(operations);
}

// writeEdgeX does
export async function writeEdgeX(edge: AssocEdgeInput): Promise<void> {
  const operations = await edgeOperations(edge);
  await executeOperations(operations, true);
}

async function edgeOperations(edge: AssocEdgeInput): Promise<DataOperation[]> {
  const edgeData = await loadEdgeData(edge.edgeType);
  if (!edgeData) {
    throw new Error(`error loading edge data for ${edge.edgeType}`);
  }

  let operations: DataOperation[] = [new CreateEdgeOperation(edge, edgeData)];

  if (edgeData.symmetricEdge) {
    operations.push(
      new CreateEdgeOperation(
        {
          id1: edge.id2,
          id1Type: edge.id2Type,
          id2: edge.id1,
          id2Type: edge.id1Type,
          edgeType: edge.edgeType,
          time: edge.time,
          data: edge.data,
        },
        edgeData,
      ),
    );
  }
  if (edgeData.inverseEdgeType) {
    operations.push(
      new CreateEdgeOperation(
        {
          id1: edge.id2,
          id1Type: edge.id2Type,
          id2: edge.id1,
          id2Type: edge.id1Type,
          edgeType: edgeData.inverseEdgeType,
          time: edge.time,
          data: edge.data,
        },
        edgeData,
      ),
    );
  }

  return operations;
}

async function loadEdgeData(edgeType: string): Promise<AssocEdgeData | null> {
  const row = await loadRow({
    tableName: "assoc_edge_config",
    fields: [
      "edge_type",
      "edge_name",
      "symmetric_edge",
      "inverse_edge_type",
      "edge_table",
    ],
    clause: query.Eq("edge_type", edgeType),
  });
  if (!row) {
    return null;
  }
  return new AssocEdgeData(row);
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

export async function loadEdges(
  id1: ID,
  edgeType: string,
): Promise<AssocEdge[]> {
  const edgeData = await loadEdgeData(edgeType);
  if (!edgeData) {
    throw new Error(`error loading edge data for ${edgeType}`);
  }
  const rows = await loadRows({
    tableName: edgeData.edgeTable,
    fields: edgeFields,
    clause: query.And(query.Eq("id1", id1), query.Eq("edge_type", edgeType)),
    orderby: "time DESC",
  });

  let result: AssocEdge[] = [];
  for (const row of rows) {
    result.push(new AssocEdge(row));
  }
  return result;
}

export async function loadUniqueEdge(
  id1: ID,
  edgeType: string,
): Promise<AssocEdge | null> {
  const edgeData = await loadEdgeData(edgeType);
  if (!edgeData) {
    throw new Error(`error loading edge data for ${edgeType}`);
  }
  const row = await loadRow({
    tableName: edgeData.edgeTable,
    fields: edgeFields,
    clause: query.And(query.Eq("id1", id1), query.Eq("edge_type", edgeType)),
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
  const edge = await loadUniqueEdge(id1, edgeType);
  if (!edge) {
    return null;
  }
  return await loadEnt(viewer, edge.id2, options);
}

export async function loadRawEdgeCountX(
  id1: ID,
  edgeType: string,
): Promise<number> {
  const edgeData = await loadEdgeData(edgeType);
  if (!edgeData) {
    throw new Error(`error loading edge data for ${edgeType}`);
  }

  const row = await loadRowX({
    tableName: edgeData.edgeTable,
    fields: ["count(1)"],
    clause: query.And(query.Eq("id1", id1), query.Eq("edge_type", edgeType)),
  });
  return parseInt(row["count"], 10);
}

export async function loadEdgeForID2(
  id1: ID,
  edgeType: string,
  id2: ID,
): Promise<AssocEdge | undefined> {
  // TODO at some point, same as in go, we can be smart about this and have heuristics to determine if we fetch everything here or not
  // we're assuming a cache here but not always tue and this can be expensive if not...
  const edges = await loadEdges(id1, edgeType);
  return edges.find(edge => edge.id2 == id2);
}

export async function loadNodesByEdge<T extends Ent>(
  viewer: Viewer,
  id1: ID,
  edgeType: string,
  options: LoadEntOptions<T>,
): Promise<T[]> {
  // load edges
  const rows = await loadEdges(id1, edgeType);

  // extract id2s
  const ids = rows.map(row => row.id2);

  return loadEnts(viewer, options, ...ids);
}

export async function loadEntsFromClause<T extends Ent>(
  viewer: Viewer,
  clause: query.Clause,
  options: LoadEntOptions<T>,
): Promise<T[]> {
  loadRows;
  const rowOptions: LoadRowOptions = {
    ...options,
    clause: clause,
  };

  const nodes = await loadRows(rowOptions);
  // apply privacy logic
  const ents = await Promise.all(
    nodes.map(row => {
      // todo eventually there'll be a different key
      const ent = new options.ent(viewer, row["id"], row);
      return applyPrivacyPolicyForEnt(viewer, ent);
    }),
  );
  return ents.filter(ent => ent) as T[];
}
