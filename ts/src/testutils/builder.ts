import {
  Ent,
  ID,
  Viewer,
  DataOperation,
  EntConstructor,
  Queryer,
} from "../ent";
import { PrivacyPolicy, AlwaysAllowRule } from "../privacy";
import { Orchestrator, EntChangeset } from "../orchestrator";
import {
  Action,
  Builder,
  Changeset,
  WriteOperation,
  Validator,
  Trigger,
  saveBuilder,
  saveBuilderX,
  Executor,
  Observer,
} from "../action";
import Schema from "../schema";
import { LoggedOutViewer } from "./../viewer";
import { QueryRecorder } from "./db_mock";

export class User implements Ent {
  id: ID;
  accountID: string;
  nodeType = "User";
  privacyPolicy: PrivacyPolicy = {
    rules: [AlwaysAllowRule],
  };
  constructor(public viewer: Viewer, id: ID, public data: {}) {
    this.id = id;
  }
}

export class Event implements Ent {
  id: ID;
  accountID: string;
  nodeType = "Event";
  privacyPolicy: PrivacyPolicy = {
    rules: [AlwaysAllowRule],
  };
  constructor(public viewer: Viewer, id: ID, public data: {}) {
    this.id = id;
  }
}

export class Contact implements Ent {
  id: ID;
  accountID: string;
  nodeType = "Contact";
  privacyPolicy: PrivacyPolicy = {
    rules: [AlwaysAllowRule],
  };
  constructor(public viewer: Viewer, id: ID, public data: {}) {
    this.id = id;
  }
}

export class Group implements Ent {
  id: ID;
  accountID: string;
  nodeType = "Group";
  privacyPolicy: PrivacyPolicy = {
    rules: [AlwaysAllowRule],
  };
  constructor(public viewer: Viewer, id: ID, public data: {}) {
    this.id = id;
  }
}

export class Message implements Ent {
  id: ID;
  accountID: string;
  nodeType = "Message";
  privacyPolicy: PrivacyPolicy = {
    rules: [AlwaysAllowRule],
  };
  constructor(public viewer: Viewer, id: ID, public data: {}) {
    this.id = id;
  }
}

export interface BuilderSchema<T extends Ent> extends Schema {
  ent: EntConstructor<T>;
}

function randomNum(): string {
  return Math.random()
    .toString(10)
    .substring(2);
}

// reuses orchestrator and standard things
export class SimpleBuilder<T extends Ent> implements Builder<T> {
  ent: EntConstructor<T>;
  placeholderID: ID;
  public orchestrator: Orchestrator<T>;

  constructor(
    public viewer: Viewer,
    private schema: BuilderSchema<T>,
    public fields: Map<string, any>,
    public operation: WriteOperation = WriteOperation.Insert,
    public existingEnt: Ent | undefined = undefined,
    action?: Action<T> | undefined,
  ) {
    // create dynamic placeholder
    this.placeholderID = `$ent.idPlaceholderID$ ${randomNum()}`;

    this.ent = schema.ent;
    this.orchestrator = new Orchestrator({
      viewer: this.viewer,
      operation: operation,
      tableName: this.ent.name,
      ent: this.ent,
      builder: this,
      action: action,
      schema: this.schema,
      editedFields: () => {
        return this.fields;
      },
    });
  }

  build(): Promise<Changeset<T>> {
    return this.orchestrator.build();
  }
}

export class SimpleAction<T extends Ent> implements Action<T> {
  builder: SimpleBuilder<T>;
  validators: Validator<T>[] = [];
  triggers: Trigger<T>[] = [];
  observers: Observer<T>[] = [];
  privacyPolicy: PrivacyPolicy;

  constructor(
    public viewer: Viewer,
    schema: BuilderSchema<T>,
    fields: Map<string, any>,
    operation: WriteOperation = WriteOperation.Insert,
    existingEnt: T | undefined = undefined,
  ) {
    this.builder = new SimpleBuilder(
      this.viewer,
      schema,
      fields,
      operation,
      existingEnt,
      this,
    );
  }

  changeset(): Promise<Changeset<T>> {
    return this.builder.build();
  }

  valid(): Promise<boolean> {
    return this.builder.orchestrator.valid();
  }

  validX(): Promise<void> {
    return this.builder.orchestrator.validX();
  }

  async saveX(): Promise<T | void> {
    await saveBuilderX(this.builder);
    if (this.builder.operation !== WriteOperation.Delete) {
      let ent = await this.builder.orchestrator.editedEnt();
      if (ent) {
        return ent;
      }
    }
  }

  async editedEnt(): Promise<T | null> {
    return await this.builder.orchestrator.editedEnt();
  }
}

export class FakeBuilder<T extends Ent> implements Builder<T> {
  placeholderID: ID;
  viewer: Viewer;
  triggers: Trigger<T>[] = [];

  private dependencies: Map<ID, Builder<T>> = new Map();
  private changesets: Changeset<T>[] = [];

  private ops: DataOperation[] = [];
  constructor(
    private fields: Map<string, any>,
    public operation: WriteOperation = WriteOperation.Insert,
    public ent: EntConstructor<T>,
    public existingEnt: Ent | undefined = undefined,
  ) {
    // create dynamic placeholder
    this.placeholderID = `$ent.idPlaceholderID$ ${randomNum()}`;

    this.viewer = new LoggedOutViewer();
    if (this.fields.size) {
      for (let [key, value] of this.fields) {
        if (this.isBuilder(value)) {
          let builder = value;
          this.dependencies.set(builder.placeholderID, builder);
        }
      }
      this.ops.push(new dataOp(this.fields, this.operation));
    }
  }

  addEdge(options: edgeOpOptions): FakeBuilder<T> {
    this.ops.push(new edgeOp(options));
    return this;
  }

  async build(): Promise<Changeset<T>> {
    // TODO need dependencies and changesets to test the complicated cases...
    return new EntChangeset(
      this.viewer,
      this.placeholderID,
      this.ent,
      this.ops,
    );
  }

  // should really just double down on orchestrator type tests instead of what we have here...
  private isBuilder(val: any): val is Builder<T> {
    return (val as Builder<T>).placeholderID !== undefined;
  }

  createdEnt(): T | null {
    let dataOp = this.ops[0];
    if (!dataOp || !dataOp.returnedEntRow) {
      return null;
    }
    let row = dataOp.returnedEntRow();
    if (!row) {
      return null;
    }
    return new this.ent(this.viewer, row["id"], row);
  }

  async save(): Promise<T | null> {
    await saveBuilder(this);
    return this.createdEnt();
  }

  async saveX(): Promise<T> {
    await saveBuilderX(this);
    return this.createdEnt()!;
  }
}

class dataOp implements DataOperation {
  private id: ID | null;
  constructor(
    private fields: Map<string, any>,
    private operation: WriteOperation,
  ) {
    if (this.operation === WriteOperation.Insert) {
      this.id = QueryRecorder.newID();
    }
  }

  async performWrite(queryer: Queryer): Promise<void> {
    let keys: string[] = [];
    let values: any[] = [];
    for (const [key, value] of this.fields) {
      keys.push(key);
      values.push(value);
    }
    if (this.operation === WriteOperation.Insert) {
      keys.push("id");
      values.push(this.id);
    }
    queryer.query(`${this.operation} ${keys.join(", ")}`, values);
  }

  returnedEntRow?(): {} | null {
    if (this.operation === WriteOperation.Insert) {
      let row = {};
      for (const [key, value] of this.fields) {
        row[key] = value;
      }
      row["id"] = this.id;
      return row;
    }
    return null;
  }

  // TODO resolve values here...
}

interface edgeOpOptions {
  id1: ID;
  id2: ID;
  id1Placeholder?: boolean;
  id2Placeholder?: boolean;
}

class edgeOp implements DataOperation {
  constructor(private options: edgeOpOptions) {}

  async performWrite(queryer: Queryer): Promise<void> {
    queryer.query("edge", [this.options.id1, this.options.id2]);
  }

  resolve<T extends Ent>(executor: Executor<T>): void {
    if (this.options.id1Placeholder) {
      let ent = executor.resolveValue(this.options.id1);
      if (!ent) {
        throw new Error(
          `could not resolve id1 placeholder ${this.options.id1}`,
        );
      }
      this.options.id1 = ent.id;
    }
    if (this.options.id2Placeholder) {
      let ent = executor.resolveValue(this.options.id2);
      if (!ent) {
        throw new Error(
          `could not resolve id2 placeholder ${this.options.id2}`,
        );
      }
      this.options.id2 = ent.id;
    }
  }
}
