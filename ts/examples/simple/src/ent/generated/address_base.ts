// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  loadEnt,
  ID,
  Viewer,
  loadEntX,
  loadEnts,
  //  LoadEntOptions,
} from "ent/ent";
import { AlwaysDenyRule, PrivacyPolicy } from "ent/privacy";
import { Field, getFields } from "ent/schema";
import schema from "src/schema/address";
import { NodeType } from "src/ent/const";

import { AddressInterface } from "src/ent/generated/interfaces";
import { AddressLoader } from "src/ent/generated/loaders";
//const tableName = "addresses";

export class AddressBase implements AddressInterface {
  readonly nodeType = NodeType.Address;
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
    //    this: new (viewer: Viewer, id: ID, data: {}) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T | null> {
    return loadEnt(viewer, id, AddressLoader.loaderOptions());
  }

  static async loadX<T extends AddressBase>(
    //    this: new (viewer: Viewer, id: ID, data: {}) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return loadEntX(viewer, id, AddressLoader.loaderOptions());
  }

  static async loadMany<T extends AddressBase>(
    //    this: new (viewer: Viewer, id: ID, data: {}) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<T[]> {
    return loadEnts(viewer, AddressLoader.loaderOptions(), ...ids);
  }

  // static loaderOptions<T extends AddressBase>(
  //   this: new (viewer: Viewer, id: ID, data: {}) => T,
  // ): LoadEntOptions<T> {
  //   return {
  //     tableName: tableName,
  //     fields: AddressBase.getFields(),
  //     ent: this,
  //   };
  // }

  // private static getFields(): string[] {
  //   return ["id", "created_at", "updated_at", "street_name", "city", "zip"];
  // }

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
