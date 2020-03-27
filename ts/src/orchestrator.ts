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
  CreateRowOperation,
  Queryer,
} from "./ent";
import { Field, getFields } from "./schema";
import { Changeset, Executor } from "./action";
import { WriteOperation, Builder, Action } from "./action";
import { snakeCase } from "snake-case";

// T is useless probably
export interface FieldInfo {
  field: Field;
  value: any;
}

export interface OrchestratorOptions<T extends Ent> {
  viewer: Viewer;
  operation: WriteOperation;
  tableName: string;
  ent: EntConstructor<T>; // should we make it nullable for delete?
  existingEnt?: Ent; // allowed to be null for create

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
  // this should be edge operations...
  private edgeOps: EdgeOperation<T>[] = [];
  private edgeSet: Set<string> = new Set<string>();
  existingEnt: Ent | undefined;

  constructor(
    // public readonly viewer: Viewer,
    // public readonly operation: ActionOperation,
    private options: OrchestratorOptions<T>,
  ) {
    this.existingEnt = options.existingEnt;
  }

  addInboundEdge(
    id1: ID | Builder<T>,
    edgeType: string,
    nodeType: string,
    options?: AssocEdgeInputOptions,
  ) {
    this.edgeOps.push(
      EdgeOperation.inboundEdge(
        edgeType,
        id1,
        nodeType,
        this.options.builder,
        options,
      ),
    );
    this.edgeSet.add(edgeType);
  }

  addOutboundEdge(
    id2: ID | Builder<T>,
    edgeType: string,
    nodeType: string,
    options?: AssocEdgeInputOptions,
  ) {
    // TODO
  }

  removeInboundEdge(id1: ID, edgeType: string, nodeType: string) {
    // TODO
  }

  removeOutboundEdge(id2: ID, edgeType: string, nodeType: string) {
    // TODO
  }

  async build(): Promise<EntChangeset<T>> {
    // TODO...
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
      data[dbKey] = value;
    }

    let ops: DataOperation[] = [
      ...this.edgeOps,
      new CreateRowOperation({
        fields: data,
        tableName: this.options.tableName,
      }),
    ];

    return new EntChangeset(
      this.options.viewer,
      this.options.builder.placeholderID,
      this.options.ent,
      ops,
    );
  }
}

// TODO implements DataOperation and move functionality away
class EdgeOperation<T extends Ent> implements DataOperation {
  private createRow: DataOperation;
  private constructor(edge: AssocEdgeInput) {
    // TODO
    this.createRow = new CreateEdgeOperation(edge, new AssocEdgeData({}));
  }

  performWrite(q: Queryer): Promise<void> {
    return this.createRow.performWrite(q);
  }

  static inboundEdge<T extends Ent>(
    edgeType: string,
    id1: Builder<T> | ID,
    nodeType: string,
    builder: Builder<T>, // todo builder?
    options?: AssocEdgeInputOptions,
  ): EdgeOperation<T> {
    let id1Val: ID;
    if (typeof id1 === "string" || typeof id1 === "number") {
      id1Val = id1;
    } else {
      id1Val = id1.placeholderID;
    }
    let id2Val: ID;
    let id2Type: string;

    if (builder.existingEnt) {
      id2Val = builder.existingEnt.id;
      id2Type = builder.existingEnt.nodeType;
    } else {
      // get placeholder.
      id2Val = builder.placeholderID;
      // expected to be filled later
      id2Type = "";
    }
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
