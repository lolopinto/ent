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
import { AlwaysAllowRule, PrivacyPolicy } from "ent/privacy";
import { Field, getFields } from "ent/schema";
import schema from "./../schema/address";

const tableName = "addresses";

export default class Address {
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly streetName: string;
  readonly city: string;
  readonly zip: string;

  constructor(public viewer: Viewer, id: ID, options: {}) {
    this.id = id;
    // TODO don't double read id
    this.id = options["id"];
    this.createdAt = options["created_at"];
    this.updatedAt = options["updated_at"];
    this.streetName = options["street_name"];
    this.city = options["city"];
    this.zip = options["zip"];
  }

  // TODO change defaults here
  privacyPolicy: PrivacyPolicy = {
    rules: [AlwaysAllowRule],
  };

  static async load(viewer: Viewer, id: ID): Promise<Address | null> {
    return loadEnt(viewer, id, Address.getOptions());
  }

  static async loadX(viewer: Viewer, id: ID): Promise<Address> {
    return loadEntX(viewer, id, Address.getOptions());
  }

  private static getFields(): string[] {
    return ["id", "created_at", "updated_at", "street_name", "city", "zip"];
  }

  private static schemaFields: Map<string, Field>;

  private static getSchemaFields(): Map<string, Field> {
    if (Address.schemaFields != null) {
      return Address.schemaFields;
    }
    return (Address.schemaFields = getFields(schema));
  }

  static getField(key: string): Field | undefined {
    return Address.getSchemaFields().get(key);
  }

  private static getOptions(): LoadEntOptions<Address> {
    return {
      tableName: tableName,
      fields: Address.getFields(),
      ent: Address,
    };
  }
}

// no actions yet so we support full create, edit, delete for now
export interface AddressCreateInput {
  streetName: string;
  city: string;
  zip: string;
}

export interface AddressEditInput {
  streetName?: string;
  city?: string;
  zip?: string;
}

function defaultValue(key: string, property: string): any {
  let fn = Address.getField(key)?.[property];
  if (!fn) {
    return null;
  }
  return fn();
}

export async function createAddress(
  viewer: Viewer,
  input: AddressCreateInput
): Promise<Address | null> {
  let fields = {
    id: defaultValue("ID", "defaultValueOnCreate"),
    created_at: defaultValue("createdAt", "defaultValueOnCreate"),
    updated_at: defaultValue("updatedAt", "defaultValueOnCreate"),
    street_name: input.streetName,
    city: input.city,
    zip: input.zip,
  };

  return await createEnt(viewer, {
    tableName: tableName,
    fields: fields,
    ent: Address,
  });
}

export async function editAddress(
  viewer: Viewer,
  id: ID,
  input: AddressEditInput
): Promise<Address | null> {
  const setField = function(key: string, value: any) {
    if (value !== undefined) {
      // nullable fields allowed
      fields[key] = value;
    }
  };
  let fields = {
    updated_at: defaultValue("updatedAt", "defaultValueOnEdit"),
  };
  setField("street_name", input.streetName);
  setField("city", input.city);
  setField("zip", input.zip);

  return await editEnt(viewer, id, {
    tableName: tableName,
    fields: fields,
    ent: Address,
  });
}

export async function deleteAddress(viewer: Viewer, id: ID): Promise<null> {
  return await deleteEnt(viewer, id, {
    tableName: tableName,
  });
}
