import {
  Viewer,
  ID,
  DataOperation,
  Ent,
  EntConstructor,
  AssocEdgeInput,
  AssocEdgeInputOptions,
  createEnt,
} from "ent/ent";
import { Action, Builder, WriteOperation, Changeset } from "ent/action";
import { Orchestrator, FieldInfo } from "ent/orchestrator";

import User from "src/ent/user";
import { EdgeType, NodeType } from "src/ent/const";
import schema from "src/schema/user";
import { Field, getFields } from "ent/schema";

//export interface
export interface UserCreateInput {
  firstName: string;
  lastName: string;
  emailAddress: string;
}

// hmm todo
// need to be able to share this amongst create and edit...
export interface UserInput {
  firstName?: string;
  lastName?: string;
  emailAddress?: string;
  requiredFields: string[];
}

export interface UserAction extends Action<User> {
  getFields(): UserInput;
}
// getInputFn

function randomNum(): string {
  return Math.random()
    .toString(10)
    .substring(2);
}

export class UserBuilder implements Builder<User> {
  private orchestrator: Orchestrator<User>;
  readonly placeholderID: ID;
  readonly ent: EntConstructor<User>;

  public constructor(
    public readonly viewer: Viewer,
    public readonly operation: WriteOperation,
    private action: UserAction,
    public readonly existingEnt: Ent | undefined,
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
      //      schema: schema,
      //      placeholderID: this.placeholderID,
      editedFields: this.getEditedFields,
    });
    //    this.placeholderID = this.orchestrator.placeholderID;
  }

  private getEditedFields(): Map<string, any> {
    // todo kill types
    const fields = this.action.getFields();

    // required fields
    let m = {};
    let result = new Map<string, any>();
    //    let result: FieldInfo[] = [];
    for (const field of fields.requiredFields) {
      m[field] = true;
    }

    const addField = function(key: string, value: any, setNull: boolean) {
      if (value !== undefined) {
        result[key] = value;
      } else if (setNull) {
        result[key] = null;
      }
    };
    // we need the defaults too!

    const schemaFields = getFields(schema);

    // this should really just be fieldName -> val...
    // and account for required fields and pass undefined
    // TODO...
    // we need to put null in these cases which is different from undefined later
    addField("firstName", fields.firstName, m["firstName"]);
    addField("lastName", fields.firstName, m["lastName"]);
    addField("emailAddress", fields.firstName, m["emailAddress"]);

    return result;
  }
  // private static schemaFields: Map<string, Field<any>>;

  // // pass schema to orchestrator instead of this
  // // and then also pass fields
  // private static getSchemaFields(): Map<string, Field<any>> {
  //   if (UserBuilder.schemaFields != null) {
  //     return UserBuilder.schemaFields;
  //   }
  //   return (UserBuilder.schemaFields = getFields(schema));
  // }
  // need a way to map schemaName to input key

  // hmm function overloading doesn't work in classes?
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
    //    users.map(user => this.addFriendID(user.id));
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

  async build(): Promise<Changeset<User>> {
    return this.orchestrator.build();
  }
}

export class CreateUserAction implements Action<User> {
  //  private orchestrator: Orchestrator<User>;
  public readonly builder: Builder<User>;

  protected constructor(
    public readonly viewer: Viewer,
    private input: UserCreateInput,
  ) {
    this.builder = new UserBuilder(
      this.viewer,
      WriteOperation.Insert,
      this,
      null,
    );
    // this.orchestrator = new Orchestrator(viewer, ActionOperation.Create, {
    //   tableName: "users",
    //   ent: User,
    //   action: this,
    // });
  }

  getFields(): UserInput {
    return {
      ...this.input,
      requiredFields: ["firstName", "lastName", "emailAddress"],
    };
  }

  //  builder()
  async changeset(): Promise<Changeset<User>> {
    return this.builder.build();
  }

  ent: User;

  async save(): Promise<User | null> {
    //    return createEnt(this.viewer,this);
    return null;
  }

  // TODO....
  // this should throw and not return X
  async saveX(): Promise<User | null> {
    return null;
  }

  // this API doesn't work because yes even though we have input, we want optional builder params....
  // TODO this...
  static create(viewer: Viewer, input: UserCreateInput): CreateUserAction {
    return new CreateUserAction(viewer, input);
  }
}
