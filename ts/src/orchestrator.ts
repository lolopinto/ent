import {
  ID,
  Ent,
  Viewer,
  EntConstructor,
  AssocEdgeInputOptions,
  DataOperation,
  EdgeOperation,
  EditNodeOperation,
  DeleteNodeOperation,
  loadEdgeDatas,
} from "./ent";
import { getFields } from "./schema";
import { Changeset, Executor } from "./action";
import { WriteOperation, Builder, Action } from "./action";
import { snakeCase } from "snake-case";
import { LoggedOutViewer } from "./viewer";

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

  private buildDeleteOp(): DeleteNodeOperation {
    if (!this.options.builder.existingEnt) {
      throw new Error("existing ent required with delete operation");
    }
    return new DeleteNodeOperation(this.options.builder.existingEnt.id, {
      tableName: this.options.tableName,
    });
  }

  private buildEditOp(): EditNodeOperation<T> {
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

    return new EditNodeOperation(
      {
        fields: data,
        tableName: this.options.tableName,
      },
      this.options.ent,
      this.options.builder.existingEnt,
    );
  }

  private async buildEdgeOps(ops: DataOperation<T>[]): Promise<void> {
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
    let ops: DataOperation<T>[] = [];

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

export class EntChangeset<T extends Ent> implements Changeset<T> {
  constructor(
    public viewer: Viewer,
    public readonly placeholderID: ID,
    public readonly ent: EntConstructor<T>,
    public operations: DataOperation<T>[],
  ) {}

  executor(): ListBasedExecutor<T> {
    return new ListBasedExecutor(this.placeholderID, this.ent, this.operations);
  }
}

export class ListBasedExecutor<T extends Ent> implements Executor<T> {
  private idx: number = 0;
  constructor(
    private placeholderID: ID,
    // todo probably don't need this actually...
    private ent: EntConstructor<T>,
    private operations: DataOperation<T>[],
  ) {}
  private lastOp: DataOperation<T> | undefined;
  private createdEnt: T | null; // hmm we don't

  // todo...
  // we're going to eventually need this passed to each operation correctly though but we can deal with it then e.g. when creating multiple objects, the executor
  resolveValue(val: any): T | null {
    if (val === this.placeholderID && val !== undefined) {
      return this.createdEnt;
    }

    return null;
  }

  [Symbol.iterator]() {
    return this;
  }

  // simple case which assumes only 1 data based ent and edges. used for tests
  // not for production
  // TODO this is the main work
  // add test in orchestrator.ts with fake operations which PerformWrite() but do nothing and see
  // what happens here
  next(): IteratorResult<DataOperation<T>> {
    if (this.lastOp && this.lastOp.returnedEntRow) {
      this.createdEnt = this.lastOp.returnedEntRow(new LoggedOutViewer());
    }
    const done = this.idx === this.operations.length;
    const op = this.operations[this.idx];
    this.idx++;
    this.lastOp = op;
    return {
      value: op,
      done: done,
    };
  }
}
