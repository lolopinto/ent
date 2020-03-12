// these are dependent on having the right tsconfig.json file...
import {
  loadEnt,
  ID,
  Viewer,
  loadEntX,
  LoadEntOptions,
  createEnt,
  editEnt,
  deleteEnt,
} from "ent/ent";
import { AlwaysDenyRule, PrivacyPolicy } from "ent/privacy";
import { Field, getFields } from "ent/schema";
import schema from "src/schema/user";

const tableName = "users";

export abstract class UserBase {
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly firstName: string;
  readonly lastName: string;

  constructor(public viewer: Viewer, id: ID, data: {}) {
    this.id = id;
    // TODO don't double read id
    this.id = data["id"];
    this.createdAt = data["created_at"];
    this.updatedAt = data["updated_at"];
    this.firstName = data["first_name"];
    this.lastName = data["last_name"];
  }

  // by default, we always deny and it's up to the ent
  // to overwrite this privacy policy in its subclasses

  privacyPolicy: PrivacyPolicy = {
    rules: [AlwaysDenyRule],
  };

  protected static async loadFrom<T extends UserBase>(
    viewer: Viewer,
    id: ID,
    arg: new (viewer: Viewer, id: ID, data: {}) => T,
  ): Promise<T | null> {
    return loadEnt(viewer, id, UserBase.getOptions(arg));
  }

  protected static async loadXFrom<T extends UserBase>(
    viewer: Viewer,
    id: ID,
    arg: new (viewer: Viewer, id: ID, data: {}) => T,
  ): Promise<T> {
    return loadEntX(viewer, id, UserBase.getOptions(arg));
  }

  private static getFields(): string[] {
    return ["id", "created_at", "updated_at", "first_name", "last_name"];
  }

  private static schemaFields: Map<string, Field>;

  private static getSchemaFields(): Map<string, Field> {
    if (UserBase.schemaFields != null) {
      return UserBase.schemaFields;
    }
    return (UserBase.schemaFields = getFields(schema));
  }

  static getField(key: string): Field | undefined {
    return UserBase.getSchemaFields().get(key);
  }

  private static getOptions<T extends UserBase>(
    arg: new (viewer: Viewer, id: ID, data: {}) => T,
  ): LoadEntOptions<T> {
    return {
      tableName: tableName,
      fields: UserBase.getFields(),
      ent: arg,
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
  let fn = UserBase.getField(key)?.[property];
  if (!fn) {
    return null;
  }
  return fn();
}

export async function createUserFrom<T extends UserBase>(
  viewer: Viewer,
  input: UserCreateInput,
  arg: new (viewer: Viewer, id: ID, data: {}) => T,
): Promise<T | null> {
  let fields = {
    id: defaultValue("ID", "defaultValueOnCreate"),
    created_at: defaultValue("createdAt", "defaultValueOnCreate"),
    updated_at: defaultValue("updatedAt", "defaultValueOnCreate"),
    first_name: input.firstName,
    last_name: input.lastName,
  };

  return await createEnt(viewer, {
    tableName: tableName,
    fields: fields,
    ent: arg,
  });
}

export async function editUserFrom<T extends UserBase>(
  viewer: Viewer,
  id: ID,
  input: UserEditInput,
  arg: new (viewer: Viewer, id: ID, data: {}) => T,
): Promise<T | null> {
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

  return await editEnt(viewer, id, {
    tableName: tableName,
    fields: fields,
    ent: arg,
  });
}

export async function deleteUser(viewer: Viewer, id: ID): Promise<null> {
  return await deleteEnt(viewer, id, {
    tableName: tableName,
  });
}
