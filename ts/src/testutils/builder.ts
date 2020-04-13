import { Ent, ID, Viewer, EntConstructor } from "../ent";
import { PrivacyPolicy, AlwaysAllowRule } from "../privacy";
import { Orchestrator } from "../orchestrator";
import { LoggedOutViewer } from "../viewer";
import {
  Action,
  Builder,
  Changeset,
  WriteOperation,
  Validator,
  saveBuilderXNoEnt,
} from "../action";

export class User implements Ent {
  id: ID;
  accountID: string;
  nodeType = "User";
  privacyPolicy: PrivacyPolicy = {
    rules: [AlwaysAllowRule],
  };
  constructor(public viewer: Viewer, id: ID, data: {}) {
    this.id = id;
  }
}

export class SimpleBuilder implements Builder<User> {
  ent = User;
  placeholderID = "1";
  viewer: Viewer;
  public orchestrator: Orchestrator<User>;

  constructor(
    private schema: any,
    public fields: Map<string, any>,
    public operation: WriteOperation = WriteOperation.Insert,
    public existingEnt: Ent | undefined = undefined,
    action?: Action<User> | undefined,
  ) {
    this.viewer = new LoggedOutViewer();
    this.orchestrator = new Orchestrator({
      viewer: this.viewer,
      operation: operation,
      tableName: "foo",
      ent: User,
      builder: this,
      action: action,
      schema: this.schema,
      editedFields: () => {
        return this.fields;
      },
    });
  }

  build(): Promise<Changeset<User>> {
    return this.orchestrator.build();
  }
}

export class SimpleAction implements Action<User> {
  viewer: Viewer;
  builder: SimpleBuilder;
  validators: Validator[] = [];

  constructor(
    schema: any,
    fields: Map<string, any>,
    operation: WriteOperation = WriteOperation.Insert,
    existingEnt: Ent | undefined = undefined,
  ) {
    this.builder = new SimpleBuilder(
      schema,
      fields,
      operation,
      existingEnt,
      this,
    );
    this.viewer = this.builder.viewer;
  }

  changeset(): Promise<Changeset<User>> {
    return this.builder.build();
  }

  valid(): Promise<boolean> {
    return this.builder.orchestrator.valid();
  }

  validX(): Promise<void> {
    return this.builder.orchestrator.validX();
  }

  async saveX(): Promise<void> {
    await saveBuilderXNoEnt(this.builder);
  }
}
