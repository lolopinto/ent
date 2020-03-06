import {loadEnt, ID, loadEntX, LoadEntOptions, createEnt, editEnt, deleteEnt} from "../../../../src/ent"
import { v4 as uuidv4 } from 'uuid';

const tableName = "users";

// todo generate this
export default class User {

  readonly id: ID;
  readonly firstName: string;
  readonly lastName: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  // TODO viewer...
  constructor(id: ID, options:{}) {
    this.id = id
    this.firstName = options['first_name'];
    this.lastName = options['last_name'];
    this.createdAt = options['created_at'];
    this.updatedAt = options['updated_at'];
  }

  // TODO viewer
  static async load(id: ID): Promise<User | null>{
    return loadEnt(id, User.getOptions());
  }

  // also TODO viewer
  static async loadX(id: ID): Promise<User> {
    return loadEntX(id, User.getOptions());
  }

  private static getFields(): string[] {
    return [
      "id",
      "created_at",
      "updated_at",
      "first_name",
      "last_name",
    ];
  }

  private static getOptions(): LoadEntOptions<User> {
    return {
      tableName: tableName,
      fields: User.getFields(),
      ent: User,
    };
  }
}

export interface UserCreateInput {
  firstName: string;
  lastName: string;
}

export interface UserEditInput {
  firstName?: string;
  lastName?: string;
}

// todo viewer, mutations, actions the works
export async function createUser(input: UserCreateInput): Promise<User | null> {
  let date = new Date();
  let fields  = {
    // todo add this to fields and automate...
    "id":  uuidv4(),
    "first_name": input.firstName,
    "last_name": input.lastName,
    "created_at": date,
    "updated_at": date,
  };

  return await createEnt(
    {
      tableName: tableName,
      fields: fields,
      ent: User,
    }
  );
}

export async function editUser(id: ID, input: UserEditInput): Promise<User | null> {
  let date = new Date();
  let fields  = {
    "updated_at": date,
  };
  if (input.firstName) {
    fields["first_name"] = input.firstName
  }
  if (input.lastName) {
    fields["last_name"] = input.lastName
  }

  return await editEnt(
    id,
    {
      tableName: tableName,
      fields: fields,
      ent: User,
    }
  );
}

export async function deleteUser(id: ID): Promise<null> {
  return await deleteEnt(
    id,
    {
      tableName: tableName,
    }
  );
};