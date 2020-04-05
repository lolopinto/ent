import { Ent, ID, Viewer, EntConstructor } from "../ent";
import { PrivacyPolicy, AlwaysAllowRule } from "../privacy";
import { Orchestrator } from "../orchestrator";
import { LoggedOutViewer } from "../viewer";
import { Builder, Changeset, WriteOperation } from "../action";

export class User implements Ent {
  id: ID;
  accountID: string;
  nodeType = "User";
  privacyPolicy: PrivacyPolicy = {
    rules: [AlwaysAllowRule],
  };
  constructor(public viewer: Viewer, id: ID, data: {}) {
    this.id = id;
    //    this.id = data["id"];
  }
}

export class SimpleBuilder implements Builder<User> {
  ent = User;
  placeholderID = "1";
  viewer: Viewer;
  public orchestrator: Orchestrator<User>;

  constructor(
    private schema: any,
    private fields: Map<string, any>,
    public operation: WriteOperation = WriteOperation.Insert,
    public existingEnt: Ent | undefined = undefined,
  ) {
    this.viewer = new LoggedOutViewer();
    this.orchestrator = new Orchestrator({
      viewer: this.viewer,
      operation: operation,
      tableName: "foo",
      //      existingEnt: existingEnt,
      ent: User,
      builder: this,
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
