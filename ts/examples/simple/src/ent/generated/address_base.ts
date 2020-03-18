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
  loadUniqueEdge,
  loadUniqueNode,
} from "ent/ent";
import { AlwaysDenyRule, PrivacyPolicy } from "ent/privacy";
import { Field, getFields } from "ent/schema";
import schema from "src/schema/address";
import { EdgeType } from "src/ent/const";
import * as query from "ent/query";

const tableName = "addresses";

export class AddressBase {
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly streetName: string;
  readonly city: string;
  readonly zip: string;

  constructor(public viewer: Viewer, id: ID, data: {}) {
    this.id = id;
    // TODO don't double read id
    this.id = data["id"];
    this.createdAt = data["created_at"];
    this.updatedAt = data["updated_at"];
    this.streetName = data["street_name"];
    this.city = data["city"];
    this.zip = data["zip"];
  }

  // by default, we always deny and it's up to the ent
  // to overwrite this privacy policy in its subclasses

  privacyPolicy: PrivacyPolicy = {
    rules: [AlwaysDenyRule],
  };

  static async load<T extends AddressBase>(
    this: new (viewer: Viewer, id: ID, data: {}) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T | null> {
    return loadEnt(viewer, id, AddressBase.loaderOptions.apply(this));
  }

  static async loadX<T extends AddressBase>(
    this: new (viewer: Viewer, id: ID, data: {}) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return loadEntX(viewer, id, AddressBase.loaderOptions.apply(this));
  }

  static async loadMany<T extends AddressBase>(
    this: new (viewer: Viewer, id: ID, data: {}) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<T[]> {
    return loadEnts(viewer, AddressBase.loaderOptions.apply(this), ...ids);
  }

  static loaderOptions<T extends AddressBase>(
    this: new (viewer: Viewer, id: ID, data: {}) => T,
  ): LoadEntOptions<T> {
    return {
      tableName: tableName,
      fields: AddressBase.getFields(),
      ent: this,
    };
  }

  private static getFields(): string[] {
    return ["id", "created_at", "updated_at", "street_name", "city", "zip"];
  }

  private static schemaFields: Map<string, Field>;

  private static getSchemaFields(): Map<string, Field> {
    if (AddressBase.schemaFields != null) {
      return AddressBase.schemaFields;
    }
    return (AddressBase.schemaFields = getFields(schema));
  }

  static getField(key: string): Field | undefined {
    return AddressBase.getSchemaFields().get(key);
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
  let fn = AddressBase.getField(key)?.[property];
  if (!fn) {
    return null;
  }
  return fn();
}

export async function createAddressFrom<T extends AddressBase>(
  viewer: Viewer,
  input: AddressCreateInput,
  arg: new (viewer: Viewer, id: ID, data: {}) => T,
): Promise<T | null> {
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
    ent: arg,
  });
}

export async function editAddressFrom<T extends AddressBase>(
  viewer: Viewer,
  id: ID,
  input: AddressEditInput,
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
  setField("street_name", input.streetName);
  setField("city", input.city);
  setField("zip", input.zip);

  return await editEnt(viewer, id, {
    tableName: tableName,
    fields: fields,
    ent: arg,
  });
}

export async function deleteAddress(viewer: Viewer, id: ID): Promise<null> {
  return await deleteEnt(viewer, id, {
    tableName: tableName,
  });
}
