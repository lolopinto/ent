import { Ent, ID, Viewer, EntConstructor } from "../ent";
import { PrivacyPolicy, AlwaysAllowRule } from "../privacy";
import { Orchestrator } from "../orchestrator";
import {
  Action,
  Builder,
  Changeset,
  WriteOperation,
  Validator,
  saveBuilderXNoEnt,
  saveBuilderX,
  Trigger,
} from "../action";
import Schema from "../schema";

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

export interface BuilderSchema<T extends Ent> extends Schema {
  ent: EntConstructor<T>;
}

export class SimpleBuilder<T extends Ent> implements Builder<T> {
  ent: EntConstructor<T>;
  placeholderID = "1";
  public orchestrator: Orchestrator<T>;

  constructor(
    public viewer: Viewer,
    private schema: BuilderSchema<T>,
    public fields: Map<string, any>,
    public operation: WriteOperation = WriteOperation.Insert,
    public existingEnt: Ent | undefined = undefined,
    action?: Action<T> | undefined,
  ) {
    this.ent = schema.ent;
    this.orchestrator = new Orchestrator({
      viewer: this.viewer,
      operation: operation,
      tableName: "foo",
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
    if (this.builder.operation === WriteOperation.Delete) {
      await saveBuilderXNoEnt(this.builder);
    } else {
      return await saveBuilderX(this.builder);
    }
  }
}
