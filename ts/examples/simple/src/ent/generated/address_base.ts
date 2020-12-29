// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  loadEnt,
  ID,
  Data,
  Viewer,
  loadEntX,
  loadEnts,
  LoadEntOptions,
  loadRow,
  loadRowX,
  AlwaysDenyRule,
  AllowIfViewerRule,
  PrivacyPolicy,
  query,
} from "@lolopinto/ent";
import { Field, getFields } from "@lolopinto/ent/schema";
import { NodeType } from "src/ent/internal";
import schema from "src/schema/address";

const tableName = "addresses";

export class AddressBase {
  readonly nodeType = NodeType.Address;
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly streetName: string;
  readonly city: string;
  readonly state: string;
  readonly zip: string;
  readonly apartment: string | null;
  readonly country: string;

  constructor(public viewer: Viewer, id: ID, data: Data) {
    this.id = id;
    // TODO don't double read id
    this.id = data.id;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.streetName = data.street_name;
    this.city = data.city;
    this.state = data.state;
    this.zip = data.zip;
    this.apartment = data.apartment;
    this.country = data.country;
  }

  // by default, we always deny and it's up to the ent
  // to overwrite this privacy policy in its subclasses

  privacyPolicy: PrivacyPolicy = {
    rules: [AllowIfViewerRule, AlwaysDenyRule],
  };

  static async load<T extends AddressBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T | null> {
    return loadEnt(viewer, id, AddressBase.loaderOptions.apply(this));
  }

  static async loadX<T extends AddressBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return loadEntX(viewer, id, AddressBase.loaderOptions.apply(this));
  }

  static async loadMany<T extends AddressBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<T[]> {
    return loadEnts(viewer, AddressBase.loaderOptions.apply(this), ...ids);
  }

  static async loadRawData<T extends AddressBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    id: ID,
  ): Promise<Data | null> {
    return await loadRow({
      ...AddressBase.loaderOptions.apply(this),
      clause: query.Eq("id", id),
    });
  }

  static async loadRawDataX<T extends AddressBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    id: ID,
  ): Promise<Data> {
    return await loadRowX({
      ...AddressBase.loaderOptions.apply(this),
      clause: query.Eq("id", id),
    });
  }

  static loaderOptions<T extends AddressBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
  ): LoadEntOptions<T> {
    return {
      tableName: tableName,
      fields: AddressBase.getFields(),
      ent: this,
    };
  }

  private static getFields(): string[] {
    return [
      "id",
      "created_at",
      "updated_at",
      "street_name",
      "city",
      "state",
      "zip",
      "apartment",
      "country",
    ];
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
