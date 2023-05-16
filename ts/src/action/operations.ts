import { Queryer, SyncQueryer } from "../core/db";
import {
  Viewer,
  Ent,
  ID,
  Data,
  DataOptions,
  EditRowOptions,
  LoadEntOptions,
  Context,
  CreateRowOptions,
} from "../core/base";
import { Executor } from "../action/action";
import * as clause from "../core/clause";
import { WriteOperation, Builder } from "../action";
import { ObjectLoader } from "../core/loaders";
import {
  getStorageKey,
  SQLStatementOperation,
  TransformedEdgeUpdateOperation,
} from "../schema/schema";
import { __getGlobalSchema } from "../core/global_schema";
import {
  AssocEdgeData,
  buildQuery,
  createRow,
  createRowSync,
  deleteRows,
  deleteRowsSync,
  editRow,
  editRowSync,
  loadEdgeData,
  logQuery,
  parameterizedQueryOptions,
} from "../core/ent";

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

export interface EditNodeOptions<T extends Ent> extends EditRowOptions {
  fieldsToResolve: string[];
  loadEntOptions: LoadEntOptions<T>;
  placeholderID?: ID;
  key: string;
}

export class RawQueryOperation implements DataOperation {
  constructor(private queries: (string | parameterizedQueryOptions)[]) {}

  async performWrite(queryer: Queryer, context?: Context): Promise<void> {
    for (const q of this.queries) {
      if (typeof q === "string") {
        logQuery(q, []);
        await queryer.query(q);
      } else {
        logQuery(q.query, q.logValues || []);
        await queryer.query(q.query, q.values);
      }
    }
  }

  performWriteSync(queryer: SyncQueryer, context?: Context): void {
    for (const q of this.queries) {
      if (typeof q === "string") {
        logQuery(q, []);
        queryer.execSync(q);
      } else {
        logQuery(q.query, q.logValues || []);
        queryer.execSync(q.query, q.values);
      }
    }
  }
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
        // @ts-expect-error ID|string mismatch
        cls = clause.And(cls, optionClause);
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
    let transformed: TransformedEdgeUpdateOperation | null = null;
    let op = SQLStatementOperation.Delete;
    let updateData: Data | null = null;

    // TODO respect disableTransformations
    const transformedEdgeWrite = __getGlobalSchema()?.transformEdgeWrite;
    if (transformedEdgeWrite) {
      transformed = transformedEdgeWrite({
        op: SQLStatementOperation.Delete,
        edge,
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
        fieldsToLog: params.updateData!,
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

    const onConflictFields = ["data"];

    const extraEdgeFields = __getGlobalSchema()?.extraEdgeFields;
    if (extraEdgeFields) {
      for (const name in extraEdgeFields) {
        const f = extraEdgeFields[name];
        if (f.defaultValueOnCreate) {
          const storageKey = getStorageKey(f, name);
          fields[storageKey] = f.defaultValueOnCreate(this.builder, {});
          // onconflict make sure we override the default values
          // e.g. setting deleted_at = null for soft delete
          onConflictFields.push(storageKey);
        }
      }
    }

    // TODO respect disableTransformations

    let transformed: TransformedEdgeUpdateOperation | null = null;
    const transformEdgeWrite = __getGlobalSchema()?.transformEdgeWrite;
    if (transformEdgeWrite) {
      transformed = transformEdgeWrite({
        op: SQLStatementOperation.Insert,
        edge,
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
      `ON CONFLICT(id1, edge_type, id2) DO UPDATE SET ${onConflictFields
        .map((f) => `${f} = EXCLUDED.${f}`)
        .join(", ")}`,
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
