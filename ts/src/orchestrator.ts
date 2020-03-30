import {
  ID,
  Ent,
  AssocEdgeInput,
  Viewer,
  EntConstructor,
  AssocEdgeInputOptions,
  DataOperation,
  CreateEdgeOperation,
  AssocEdgeData,
  EditNodeOperation,
  DeleteNodeOperation,
  Queryer,
  loadEdgeDatas,
  loadEdgeData,
} from "./ent";
import { getFields } from "./schema";
import { Changeset, Executor } from "./action";
import { WriteOperation, Builder, Action } from "./action";
import { snakeCase } from "snake-case";

export interface OrchestratorOptions<T extends Ent> {
  viewer: Viewer;
  operation: WriteOperation;
  tableName: string;
  ent: EntConstructor<T>; // should we make it nullable for delete?
  //  existingEnt?: Ent; // allowed to be null for create
  // ^ should just take this from builder?

  builder: Builder<T>;
  action?: Action<T>;
  schema: any; // TODO
  editedFields(): Map<string, any>;
  // pass schema and buildFieldsFN
  // pass schema here...

  // Todo build fields
  // action needs a way to build fields as needed
}

export class Orchestrator<T extends Ent> {
  private edgeOps: EdgeOperation[] = [];
  private edgeSet: Set<string> = new Set<string>();
  //  existingEnt: Ent | undefined;

  constructor(
    // public readonly viewer: Viewer,
    // public readonly operation: ActionOperation,
    private options: OrchestratorOptions<T>,
  ) {
    //    this.existingEnt = options.existingEnt;
  }

  private addEdge(edge: EdgeOperation) {
    this.edgeOps.push(edge);
    this.edgeSet.add(edge.edgeInput.edgeType);
  }

  addInboundEdge(
    id1: ID | Builder<T>,
    edgeType: string,
    nodeType: string,
    options?: AssocEdgeInputOptions,
  ) {
    this.addEdge(
      EdgeOperation.inboundEdge(
        this.options.builder,
        edgeType,
        id1,
        nodeType,
        options,
      ),
    );
  }

  addOutboundEdge(
    id2: ID | Builder<T>,
    edgeType: string,
    nodeType: string,
    options?: AssocEdgeInputOptions,
  ) {
    this.addEdge(
      EdgeOperation.outboundEdge(
        this.options.builder,
        edgeType,
        id2,
        nodeType,
        options,
      ),
    );
  }

  removeInboundEdge(id1: ID, edgeType: string) {
    this.addEdge(
      EdgeOperation.removeInboundEdge(this.options.builder, edgeType, id1),
    );
  }

  removeOutboundEdge(id2: ID, edgeType: string) {
    this.addEdge(
      EdgeOperation.removeOutboundEdge(this.options.builder, edgeType, id2),
    );
  }

  private buildDeleteOp(): DataOperation {
    if (!this.options.builder.existingEnt) {
      throw new Error("existing ent required with delete operation");
    }
    return new DeleteNodeOperation(this.options.builder.existingEnt.id, {
      tableName: this.options.tableName,
    });
  }

  private buildEditOp(): DataOperation {
    if (
      this.options.operation === WriteOperation.Edit &&
      !this.options.builder.existingEnt
    ) {
      throw new Error("existing ent required with edit operation");
    }
    const editedFields = this.options.editedFields();
    // build up data to be saved...
    let data = {};
    const schemaFields = getFields(this.options.schema);
    for (const [fieldName, field] of schemaFields) {
      let value = editedFields.get(fieldName);
      let dbKey = field.storageKey || snakeCase(field.name);

      if (value === undefined) {
        if (
          field.defaultValueOnCreate &&
          this.options.operation === WriteOperation.Insert
        ) {
          value = field.defaultValueOnCreate();
        }

        if (
          field.defaultValueOnEdit &&
          this.options.operation === WriteOperation.Edit
        ) {
          value = field.defaultValueOnEdit();
          // TODO special case this if this is the onlything changing and don't do the write.
        }
      }

      if (value === null) {
        if (!field.nullable) {
          throw new Error(
            `field ${field.name} set to null for non-nullable field`,
          );
        }
      } else if (value === undefined) {
        if (
          !field.nullable &&
          this.options.operation === WriteOperation.Insert
        ) {
          throw new Error(`required field ${field.name} not set`);
        }
      } else {
        if (field.valid && !field.valid(value)) {
          throw new Error(`invalid field ${field.name} with value ${value}`);
        }

        if (field.format) {
          value = field.format(value);
        }
      }

      if (value !== undefined) {
        data[dbKey] = value;
      }
    }

    //    console.log(data);

    return new EditNodeOperation(
      {
        fields: data,
        tableName: this.options.tableName,
      },
      this.options.builder.existingEnt,
    );
  }

  private async buildEdgeOps(ops: DataOperation[]): Promise<void> {
    const edgeDatas = await loadEdgeDatas(...Array.from(this.edgeSet.values()));
    //    console.log(edgeDatas);
    for (const edgeOp of this.edgeOps) {
      ops.push(edgeOp);

      const edgeType = edgeOp.edgeInput.edgeType;
      const edgeData = edgeDatas.get(edgeType);
      if (!edgeData) {
        throw new Error(`could not load edge data for ${edgeType}`);
      }

      if (edgeData.symmetricEdge) {
        ops.push(edgeOp.symmetricEdge());
      }

      if (edgeData.inverseEdgeType) {
        ops.push(edgeOp.inverseEdge(edgeData));
      }
    }
  }

  async build(): Promise<EntChangeset<T>> {
    let ops: DataOperation[] = [];

    switch (this.options.operation) {
      case WriteOperation.Delete:
        ops.push(this.buildDeleteOp());
        break;
      case WriteOperation.Edit:
      case WriteOperation.Insert:
        ops.push(this.buildEditOp());
        break;
    }

    await this.buildEdgeOps(ops);

    return new EntChangeset(
      this.options.viewer,
      this.options.builder.placeholderID,
      this.options.ent,
      ops,
    );
  }
}

export class EdgeOperation implements DataOperation {
  private createRow: DataOperation;
  private constructor(
    public edgeInput: AssocEdgeInput,
    public operation: WriteOperation = WriteOperation.Insert,
  ) {
    this.createRow = new CreateEdgeOperation(edgeInput);
  }

  async performWrite(q: Queryer): Promise<void> {
    // TODO need DeleteEdgeOperation
    return this.createRow.performWrite(q);
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
      this.operation,
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
      this.operation,
    );
  }

  private static resolveIDs<T extends Ent>(
    srcBuilder: Builder<T>, // id1
    destID: Builder<T> | ID, // id2 ( and then you flip it)
  ): [ID, string, ID] {
    let destIDVal: ID;
    if (typeof destID === "string" || typeof destID === "number") {
      destIDVal = destID;
    } else {
      destIDVal = destID.placeholderID;
    }
    let srcIDVal: ID;
    let srcType: string;

    if (srcBuilder.existingEnt) {
      srcIDVal = srcBuilder.existingEnt.id;
      srcType = srcBuilder.existingEnt.nodeType;
    } else {
      console.log("placeholder");
      // get placeholder.
      srcIDVal = srcBuilder.placeholderID;
      // expected to be filled later
      srcType = "";
    }

    return [srcIDVal, srcType, destIDVal];
  }

  static inboundEdge<T extends Ent>(
    builder: Builder<T>,
    edgeType: string,
    id1: Builder<T> | ID,
    nodeType: string,
    options?: AssocEdgeInputOptions,
  ): EdgeOperation {
    // todo we still need flags to indicate something is a placeholder ID
    let [id2Val, id2Type, id1Val] = EdgeOperation.resolveIDs(builder, id1);

    const edge: AssocEdgeInput = {
      id1: id1Val,
      edgeType: edgeType,
      id2: id2Val,
      id2Type: id2Type,
      id1Type: nodeType,
      ...options,
    };

    return new EdgeOperation(edge);
  }

  static outboundEdge<T extends Ent>(
    builder: Builder<T>,
    edgeType: string,
    id2: Builder<T> | ID,
    nodeType: string,
    options?: AssocEdgeInputOptions,
  ): EdgeOperation {
    // todo we still need flags to indicate something is a placeholder ID
    let [id1Val, id1Type, id2Val] = EdgeOperation.resolveIDs(builder, id2);

    const edge: AssocEdgeInput = {
      id1: id1Val,
      edgeType: edgeType,
      id2: id2Val,
      id2Type: nodeType,
      id1Type: id1Type,
      ...options,
    };

    return new EdgeOperation(edge);
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
    return new EdgeOperation(edge, WriteOperation.Delete);
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
    return new EdgeOperation(edge, WriteOperation.Delete);
  }
}

export class EntChangeset<T extends Ent> implements Changeset<T> {
  constructor(
    public viewer: Viewer,
    public readonly placeholderID: ID,
    public readonly ent: EntConstructor<T>,
    public operations: DataOperation[],
  ) {}

  executor(): ListBasedExecutor<T> {
    return new ListBasedExecutor<T>(this.operations);
  }
}

class ListBasedExecutor<T extends Ent> implements Executor {
  private idx: number = 0;
  constructor(private operations: DataOperation[]) {}
  resolveValue(val: any): T {
    throw new Error();
  }

  [Symbol.iterator]() {
    return this;
  }

  next(): IteratorResult<DataOperation> {
    const op = this.operations[this.idx];
    const done = this.idx === this.operations.length;
    this.idx++;
    return {
      value: op,
      done: done,
    };
  }
}
