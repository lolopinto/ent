import { Ent, ID, Viewer } from "../ent";
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
  saveBuilderX,
  Trigger,
} from "../action";

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

export class SimpleBuilder implements Builder<User> {
  ent = User;
  placeholderID = "1";
  public orchestrator: Orchestrator<User>;

  constructor(
    public viewer: Viewer,
    private schema: any,
    public fields: Map<string, any>,
    public operation: WriteOperation = WriteOperation.Insert,
    public existingEnt: Ent | undefined = undefined,
    action?: Action<User> | undefined,
  ) {
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
  builder: SimpleBuilder;
  validators: Validator[] = [];
  triggers: Trigger<User>[] = [];
  privacyPolicy: PrivacyPolicy;

  constructor(
    public viewer: Viewer,
    schema: any,
    fields: Map<string, any>,
    operation: WriteOperation = WriteOperation.Insert,
    existingEnt: Ent | undefined = undefined,
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

  changeset(): Promise<Changeset<User>> {
    return this.builder.build();
  }

  valid(): Promise<boolean> {
    return this.builder.orchestrator.valid();
  }

  validX(): Promise<void> {
    return this.builder.orchestrator.validX();
  }

  async saveX(): Promise<User | void> {
    if (this.builder.operation === WriteOperation.Delete) {
      await saveBuilderXNoEnt(this.builder);
    } else {
      return await saveBuilderX(this.builder);
    }
  }
}
