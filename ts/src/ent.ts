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

import * as query from "./query";
import { WriteOperation, Builder } from "./action";
import { LoggedOutViewer } from "./viewer";

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

export interface EditRowOptions extends DataOptions {
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
  // TODO make sure to save this...
  if (ids.length === 0) {
    return [];
  }
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
  console.log(query);
  console.log(values);
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
  performWrite(queryer: Queryer): Promise<void>;
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

  async performWrite(queryer: Queryer): Promise<void> {
    if (this.existingEnt) {
      this.row = await editRow(queryer, this.options, this.existingEnt.id);
    } else {
      this.row = await createRow(queryer, this.options, "RETURNING *");
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

  async performWrite(queryer: Queryer): Promise<void> {
    const edge = this.edgeInput;

    let edgeData = await loadEdgeData(edge.edgeType);
    if (!edgeData) {
      throw new Error(`error loading edge data for ${edge.edgeType}`);
    }

    switch (this.options.operation) {
      case WriteOperation.Delete:
        return this.performDeleteWrite(queryer, edgeData, edge);
      case WriteOperation.Insert:
      case WriteOperation.Edit:
        return this.performInsertWrite(queryer, edgeData, edge);
    }
  }

  private async performDeleteWrite(
    q: Queryer,
    edgeData: AssocEdgeData,
    edge: AssocEdgeInput,
  ): Promise<void> {
    return deleteRow(
      q,
      {
        tableName: edgeData.edgeTable,
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

async function createRow(
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

  logQuery(query, values);

  const res = await queryer.query(query, values);

  if (res.rowCount == 1) {
    return res.rows[0];
  }
  return null;
}

async function editRow(
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

  let query = `UPDATE ${options.tableName} SET ${vals} WHERE id = $${idx} RETURNING *`;
  logQuery(query, values);

  try {
    const res = await queryer.query(query, values);

    if (res.rowCount == 1) {
      // for now assume id primary key
      // TODO make this extensible as needed.
      let row = res.rows[0];
      return row;
    }
  } catch (e) {
    console.error(e);
    return null;
  }
  return null;
}

async function deleteRow(
  queryer: Queryer,
  options: DataOptions,
  clause: query.Clause,
): Promise<void> {
  const query = `DELETE FROM ${options.tableName} WHERE ${clause.clause(1)}`;
  const values = clause.values();
  logQuery(query, values);
  await queryer.query(query, values);
}

export class DeleteNodeOperation implements DataOperation {
  constructor(private id: ID, private options: DataOptions) {}

  async performWrite(queryer: Queryer): Promise<void> {
    return deleteRow(queryer, this.options, query.Eq("id", this.id));
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

export async function loadEdgeData(
  edgeType: string,
): Promise<AssocEdgeData | null> {
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

export async function loadEdgeDatas(
  ...edgeTypes: string[]
): Promise<Map<string, AssocEdgeData>> {
  if (!edgeTypes.length) {
    return new Map();
  }

  const rows = await loadRows({
    tableName: "assoc_edge_config",
    fields: [
      "edge_type",
      "edge_name",
      "symmetric_edge",
      "inverse_edge_type",
      "edge_table",
    ],
    clause: query.In("edge_type", ...edgeTypes),
  });
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
  return edges.find((edge) => edge.id2 == id2);
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
  const ids = rows.map((row) => row.id2);

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
    nodes.map((row) => {
      // todo eventually there'll be a different key
      const ent = new options.ent(viewer, row["id"], row);
      return applyPrivacyPolicyForEnt(viewer, ent);
    }),
  );
  return ents.filter((ent) => ent) as T[];
}
