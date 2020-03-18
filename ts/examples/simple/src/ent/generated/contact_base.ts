// these are dependent on having the right tsconfig.json file...
import {
  loadEnt,
  ID,
  Viewer,
  loadEntX,
  loadEnts,
  LoadEntOptions,
  createEnt,
  editEnt,
  deleteEnt,
  AssocEdge,
  loadEdges,
  loadRawEdgeCountX,
  loadNodesByEdge,
  loadEdgeForID2,
  loadEntsFromClause,
  loadEntFromClause,
  loadEntXFromClause,
  loadRow,
} from "ent/ent";
import { AlwaysDenyRule, PrivacyPolicy } from "ent/privacy";
import { Field, getFields } from "ent/schema";
import schema from "src/schema/contact";
import { EdgeType } from "src/ent/const";
import * as query from "ent/query";
import User from "src/ent/user";

const tableName = "contacts";

export class ContactBase {
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly emailAddress: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly userID: string;

  constructor(public viewer: Viewer, id: ID, data: {}) {
    this.id = id;
    // TODO don't double read id
    this.id = data["id"];
    this.createdAt = data["created_at"];
    this.updatedAt = data["updated_at"];
    this.emailAddress = data["email_address"];
    this.firstName = data["first_name"];
    this.lastName = data["last_name"];
    this.userID = data["user_id"];
  }

  // by default, we always deny and it's up to the ent
  // to overwrite this privacy policy in its subclasses

  privacyPolicy: PrivacyPolicy = {
    rules: [AlwaysDenyRule],
  };

  static async load<T extends ContactBase>(
    this: new (viewer: Viewer, id: ID, data: {}) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T | null> {
    return loadEnt(viewer, id, ContactBase.loaderOptions.apply(this));
  }

  static async loadX<T extends ContactBase>(
    this: new (viewer: Viewer, id: ID, data: {}) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return loadEntX(viewer, id, ContactBase.loaderOptions.apply(this));
  }

  static async loadMany<T extends ContactBase>(
    this: new (viewer: Viewer, id: ID, data: {}) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<T[]> {
    return loadEnts(viewer, ContactBase.loaderOptions.apply(this), ...ids);
  }

  static loaderOptions<T extends ContactBase>(
    this: new (viewer: Viewer, id: ID, data: {}) => T,
  ): LoadEntOptions<T> {
    return {
      tableName: tableName,
      fields: ContactBase.getFields(),
      ent: this,
    };
  }

  private static getFields(): string[] {
    return [
      "id",
      "created_at",
      "updated_at",
      "email_address",
      "first_name",
      "last_name",
      "user_id",
    ];
  }

  private static schemaFields: Map<string, Field>;

  private static getSchemaFields(): Map<string, Field> {
    if (ContactBase.schemaFields != null) {
      return ContactBase.schemaFields;
    }
    return (ContactBase.schemaFields = getFields(schema));
  }

  static getField(key: string): Field | undefined {
    return ContactBase.getSchemaFields().get(key);
  }

  loadUser(): Promise<User | null> {
    return loadEnt(this.viewer, this.userID, User.loaderOptions());
  }

  loadUserX(): Promise<User> {
    return loadEntX(this.viewer, this.userID, User.loaderOptions());
  }
}

// no actions yet so we support full create, edit, delete for now
export interface ContactCreateInput {
  emailAddress: string;
  firstName: string;
  lastName: string;
  userID: string;
}

export interface ContactEditInput {
  emailAddress?: string;
  firstName?: string;
  lastName?: string;
  userID?: string;
}

function defaultValue(key: string, property: string): any {
  let fn = ContactBase.getField(key)?.[property];
  if (!fn) {
    return null;
  }
  return fn();
}

export async function createContactFrom<T extends ContactBase>(
  viewer: Viewer,
  input: ContactCreateInput,
  arg: new (viewer: Viewer, id: ID, data: {}) => T,
): Promise<T | null> {
  let fields = {
    id: defaultValue("ID", "defaultValueOnCreate"),
    created_at: defaultValue("createdAt", "defaultValueOnCreate"),
    updated_at: defaultValue("updatedAt", "defaultValueOnCreate"),
    email_address: input.emailAddress,
    first_name: input.firstName,
    last_name: input.lastName,
    user_id: input.userID,
  };

  return await createEnt(viewer, {
    tableName: tableName,
    fields: fields,
    ent: arg,
  });
}

export async function editContactFrom<T extends ContactBase>(
  viewer: Viewer,
  id: ID,
  input: ContactEditInput,
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
  setField("email_address", input.emailAddress);
  setField("first_name", input.firstName);
  setField("last_name", input.lastName);
  setField("user_id", input.userID);

  return await editEnt(viewer, id, {
    tableName: tableName,
    fields: fields,
    ent: arg,
  });
}

export async function deleteContact(viewer: Viewer, id: ID): Promise<null> {
  return await deleteEnt(viewer, id, {
    tableName: tableName,
  });
}
