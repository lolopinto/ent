import {
  loadEnt,
  ID,
  loadEntX,
  LoadEntOptions,
  createEnt,
  editEnt,
  deleteEnt,
} from "../../../../src/ent";
import { Field, getFields } from "../../../../src/schema";
import schema from "./../schema/user";

const tableName = "users";

export default class User {
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly firstName: string;
  readonly lastName: string;

  // TODO viewer...
  constructor(id: ID, options: {}) {
    this.id = id;
    // TODO don't double read id
    this.id = options["id"];
    this.createdAt = options["created_at"];
    this.updatedAt = options["updated_at"];
    this.firstName = options["first_name"];
    this.lastName = options["last_name"];
  }

  // TODO viewer
  static async load(id: ID): Promise<User | null> {
    return loadEnt(id, User.getOptions());
  }

  // also TODO viewer
  static async loadX(id: ID): Promise<User> {
    return loadEntX(id, User.getOptions());
  }

  private static getFields(): string[] {
    return ["id", "created_at", "updated_at", "first_name", "last_name"];
  }

  private static schemaFields: Map<string, Field>;

  private static getSchemaFields(): Map<string, Field> {
    if (User.schemaFields != null) {
      return User.schemaFields;
    }
    return (User.schemaFields = getFields(schema));
  }

  static getField(key: string): Field | undefined {
    return User.getSchemaFields().get(key);
  }

  private static getOptions(): LoadEntOptions<User> {
    return {
      tableName: tableName,
      fields: User.getFields(),
      ent: User,
    };
  }
}

// no actions yet so we support full create, edit, delete for now
export interface UserCreateInput {
  firstName: string;
  lastName: string;
}

export interface UserEditInput {
  firstName?: string;
  lastName?: string;
}

function defaultValue(key: string, property: string): any {
  let fn = User.getField(key)?.[property];
  if (!fn) {
    return null;
  }
  return fn();
}

export async function createUser(input: UserCreateInput): Promise<User | null> {
  let fields = {
    id: defaultValue("ID", "defaultValueOnCreate"),
    created_at: defaultValue("createdAt", "defaultValueOnCreate"),
    updated_at: defaultValue("updatedAt", "defaultValueOnCreate"),
    first_name: input.firstName,
    last_name: input.lastName,
  };

  return await createEnt({
    tableName: tableName,
    fields: fields,
    ent: User,
  });
}

export async function editUser(
  id: ID,
  input: UserEditInput
): Promise<User | null> {
  const setField = function(key: string, value: any) {
    if (value !== undefined) {
      // nullable fields allowed
      fields[key] = value;
    }
  };
  let fields = {
    updated_at: defaultValue("updatedAt", "defaultValueOnEdit"),
  };
  setField("first_name", input.firstName);
  setField("last_name", input.lastName);

  return await editEnt(id, {
    tableName: tableName,
    fields: fields,
    ent: User,
  });
}

export async function deleteUser(id: ID): Promise<null> {
  return await deleteEnt(id, {
    tableName: tableName,
  });
}
