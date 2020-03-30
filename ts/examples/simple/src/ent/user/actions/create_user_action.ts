import { Viewer, ID, Ent, AssocEdgeInputOptions } from "ent/ent";
import {
  Action,
  Builder,
  WriteOperation,
  Changeset,
  saveBuilderX,
  saveBuilder,
} from "ent/action";
import { Orchestrator } from "ent/orchestrator";

import User from "src/ent/user";
import { EdgeType, NodeType } from "src/ent/const";
import schema from "src/schema/user";

export interface UserCreateInput {
  firstName: string;
  lastName: string;
  emailAddress: string;
}

export interface UserInput {
  firstName?: string;
  lastName?: string;
  emailAddress?: string;
  requiredFields: string[];
}

export interface UserAction extends Action<User> {
  getFields(): UserInput;
}

function randomNum(): string {
  return Math.random()
    .toString(10)
    .substring(2);
}

export class UserBuilder implements Builder<User> {
  private orchestrator: Orchestrator<User>;
  readonly placeholderID: ID;
  readonly ent = User;

  public constructor(
    public readonly viewer: Viewer,
    public readonly operation: WriteOperation,
    private action: UserAction,
    public readonly existingEnt?: Ent | undefined,
  ) {
    this.placeholderID = `$ent.idPlaceholderID$ ${randomNum()}`;

    this.orchestrator = new Orchestrator({
      viewer: viewer,
      operation: this.operation,
      tableName: "users",
      ent: User,
      builder: this,
      action: action,
      schema: schema,
      editedFields: this.getEditedFields,
    });
  }

  private getEditedFields(): Map<string, any> {
    const fields = this.action.getFields();

    // required fields
    let m = {};
    let result = new Map<string, any>();
    for (const field of fields.requiredFields) {
      m[field] = true;
    }

    const addField = function(key: string, value: any, setNull: boolean) {
      if (value !== undefined) {
        result.set(key, value);
      } else if (setNull) {
        result.set(key, null);
      }
    };
    addField("FirstName", fields.firstName, m["firstName"]);
    addField("LastName", fields.lastName, m["lastName"]);
    addField("EmailAddress", fields.emailAddress, m["emailAddress"]);

    return result;
  }

  // function overload so easier for client
  addFriend(...ids: ID[]): UserBuilder;
  addFriend(...users: User[]): UserBuilder;

  addFriend(...users: ID[] | User[]): UserBuilder {
    for (const user of users) {
      if (typeof user == "object") {
        this.addFriendID(user.id);
      } else {
        this.addFriendID(user);
      }
    }
    return this;
  }

  addFriendID(id: ID, options?: AssocEdgeInputOptions): UserBuilder {
    this.orchestrator.addOutboundEdge(
      id,
      EdgeType.UserToFriends,
      NodeType.User,
      options,
    );
    return this;
  }

  removeFriend(...ids: ID[]): UserBuilder;
  removeFriend(...users: User[]): UserBuilder;

  removeFriend(...users: ID[] | User[]): UserBuilder {
    for (const user of users) {
      if (typeof user == "object") {
        this.orchestrator.removeOutboundEdge(user.id, EdgeType.UserToFriends);
      } else {
        this.orchestrator.removeOutboundEdge(user, EdgeType.UserToFriends);
      }
    }
    return this;
  }

  async build(): Promise<Changeset<User>> {
    return this.orchestrator.build();
  }
}

export class CreateUserAction implements Action<User> {
  public readonly builder: UserBuilder;

  protected constructor(
    public readonly viewer: Viewer,
    private input: UserCreateInput,
  ) {
    this.builder = new UserBuilder(this.viewer, WriteOperation.Insert, this);
  }

  getFields(): UserInput {
    return {
      ...this.input,
      requiredFields: ["FirstName", "LastName", "EmailAddress"],
    };
  }

  async changeset(): Promise<Changeset<User>> {
    return this.builder.build();
  }

  async save(): Promise<User | null> {
    return saveBuilder(this.builder);
  }

  async saveX(): Promise<User> {
    return saveBuilderX(this.builder);
  }

  // this API doesn't work because yes even though we have input, we want optional builder params....
  // TODO this...
  static create(viewer: Viewer, input: UserCreateInput): CreateUserAction {
    return new CreateUserAction(viewer, input);
  }
}

export interface UserEditInput {
  firstName?: string;
  lastName?: string;
  emailAddress?: string;
}

export class EditUserAction implements Action<User> {
  public readonly builder: UserBuilder;

  protected constructor(
    public readonly viewer: Viewer,
    user: User,
    private input: UserEditInput,
  ) {
    this.builder = new UserBuilder(
      this.viewer,
      WriteOperation.Edit,
      this,
      user,
    );
  }

  getFields(): UserInput {
    return {
      ...this.input,
      requiredFields: [],
    };
  }

  async changeset(): Promise<Changeset<User>> {
    return this.builder.build();
  }

  async save(): Promise<User | null> {
    return saveBuilder(this.builder);
  }

  async saveX(): Promise<User> {
    return saveBuilderX(this.builder);
  }

  static create(
    viewer: Viewer,
    user: User,
    input: UserEditInput,
  ): EditUserAction {
    return new EditUserAction(viewer, user, input);
  }
}

export class DeleteUserAction implements Action<User> {
  public readonly builder: UserBuilder;

  protected constructor(public readonly viewer: Viewer, user: User) {
    this.builder = new UserBuilder(
      this.viewer,
      WriteOperation.Edit,
      this,
      user,
    );
  }

  getFields(): UserInput {
    return {
      requiredFields: [],
    };
  }

  async changeset(): Promise<Changeset<User>> {
    return this.builder.build();
  }

  async save(): Promise<void> {
    await saveBuilder(this.builder);
  }

  async saveX(): Promise<void> {
    await saveBuilderX(this.builder);
  }

  static create(viewer: Viewer, user: User): DeleteUserAction {
    return new DeleteUserAction(viewer, user);
  }
}
