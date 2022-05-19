// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AllowIfViewerPrivacyPolicy,
  Context,
  CustomQuery,
  Data,
  Ent,
  ID,
  LoadEntOptions,
  PrivacyPolicy,
  Viewer,
  convertDate,
  loadCustomData,
  loadCustomEnts,
  loadEnt,
  loadEntViaKey,
  loadEntX,
  loadEntXViaKey,
  loadEnts,
} from "@snowtop/ent";
import { Field, getFields } from "@snowtop/ent/schema";
import { loadEntByType, loadEntXByType } from "src/ent/generated/loadAny";
import {
  addressLoader,
  addressLoaderInfo,
  addressOwnerIDLoader,
} from "src/ent/generated/loaders";
import { NodeType } from "src/ent/internal";
import schema from "src/schema/address";

interface AddressDBData {
  id: ID;
  created_at: Date;
  updated_at: Date;
  street: string;
  city: string;
  state: string;
  zip_code: string;
  apartment: string | null;
  owner_id: ID;
  owner_type: string;
}

export class AddressBase {
  readonly nodeType = NodeType.Address;
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly street: string;
  readonly city: string;
  readonly state: string;
  readonly zipCode: string;
  readonly apartment: string | null;
  readonly ownerID: ID;
  readonly ownerType: string;

  constructor(public viewer: Viewer, protected data: Data) {
    this.id = data.id;
    this.createdAt = convertDate(data.created_at);
    this.updatedAt = convertDate(data.updated_at);
    this.street = data.street;
    this.city = data.city;
    this.state = data.state;
    this.zipCode = data.zip_code;
    this.apartment = data.apartment;
    this.ownerID = data.owner_id;
    this.ownerType = data.owner_type;
  }

  privacyPolicy: PrivacyPolicy = AllowIfViewerPrivacyPolicy;

  static async load<T extends AddressBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T | null> {
    return (await loadEnt(
      viewer,
      id,
      AddressBase.loaderOptions.apply(this),
    )) as T | null;
  }

  static async loadX<T extends AddressBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return (await loadEntX(
      viewer,
      id,
      AddressBase.loaderOptions.apply(this),
    )) as T;
  }

  static async loadMany<T extends AddressBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<Map<ID, T>> {
    return (await loadEnts(
      viewer,
      AddressBase.loaderOptions.apply(this),
      ...ids,
    )) as Map<ID, T>;
  }

  static async loadCustom<T extends AddressBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    query: CustomQuery,
  ): Promise<T[]> {
    return (await loadCustomEnts(
      viewer,
      AddressBase.loaderOptions.apply(this),
      query,
    )) as T[];
  }

  static async loadCustomData<T extends AddressBase>(
    this: new (viewer: Viewer, data: Data) => T,
    query: CustomQuery,
    context?: Context,
  ): Promise<AddressDBData[]> {
    return (await loadCustomData(
      AddressBase.loaderOptions.apply(this),
      query,
      context,
    )) as AddressDBData[];
  }

  static async loadRawData<T extends AddressBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<AddressDBData | null> {
    const row = await addressLoader.createLoader(context).load(id);
    if (!row) {
      return null;
    }
    return row as AddressDBData;
  }

  static async loadRawDataX<T extends AddressBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<AddressDBData> {
    const row = await addressLoader.createLoader(context).load(id);
    if (!row) {
      throw new Error(`couldn't load row for ${id}`);
    }
    return row as AddressDBData;
  }

  static async loadFromOwnerID<T extends AddressBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    ownerID: ID,
  ): Promise<T | null> {
    return (await loadEntViaKey(viewer, ownerID, {
      ...AddressBase.loaderOptions.apply(this),
      loaderFactory: addressOwnerIDLoader,
    })) as T | null;
  }

  static async loadFromOwnerIDX<T extends AddressBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    ownerID: ID,
  ): Promise<T> {
    return (await loadEntXViaKey(viewer, ownerID, {
      ...AddressBase.loaderOptions.apply(this),
      loaderFactory: addressOwnerIDLoader,
    })) as T;
  }

  static async loadIDFromOwnerID<T extends AddressBase>(
    this: new (viewer: Viewer, data: Data) => T,
    ownerID: ID,
    context?: Context,
  ): Promise<ID | undefined> {
    const row = await addressOwnerIDLoader.createLoader(context).load(ownerID);
    return row?.id;
  }

  static async loadRawDataFromOwnerID<T extends AddressBase>(
    this: new (viewer: Viewer, data: Data) => T,
    ownerID: ID,
    context?: Context,
  ): Promise<AddressDBData | null> {
    const row = await addressOwnerIDLoader.createLoader(context).load(ownerID);
    if (!row) {
      return null;
    }
    return row as AddressDBData;
  }

  static loaderOptions<T extends AddressBase>(
    this: new (viewer: Viewer, data: Data) => T,
  ): LoadEntOptions<T> {
    return {
      tableName: addressLoaderInfo.tableName,
      fields: addressLoaderInfo.fields,
      ent: this,
      loaderFactory: addressLoader,
    };
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

  async loadOwner(): Promise<Ent | null> {
    return loadEntByType(
      this.viewer,
      this.ownerType as unknown as NodeType,
      this.ownerID,
    );
  }

  loadOwnerX(): Promise<Ent> {
    return loadEntXByType(
      this.viewer,
      this.ownerType as unknown as NodeType,
      this.ownerID,
    );
  }
}
