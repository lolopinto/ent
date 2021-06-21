// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AllowIfViewerPrivacyPolicy,
  Context,
  Data,
  ID,
  LoadEntOptions,
  ObjectLoaderFactory,
  PrivacyPolicy,
  Viewer,
  convertDate,
  loadEnt,
  loadEntX,
  loadEnts,
} from "@lolopinto/ent";
import { Field, getFields } from "@lolopinto/ent/schema";
import { NodeType } from "src/ent/internal";
import schema from "src/schema/holiday";

const tableName = "holidays";
const fields = ["id", "created_at", "updated_at", "label", "date"];

export class HolidayBase {
  readonly nodeType = NodeType.Holiday;
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly label: string;
  readonly date: Date;

  constructor(public viewer: Viewer, data: Data) {
    this.id = data.id;
    this.createdAt = convertDate(data.created_at);
    this.updatedAt = convertDate(data.updated_at);
    this.label = data.label;
    this.date = convertDate(data.date);
  }

  // default privacyPolicy is Viewer can see themselves
  privacyPolicy: PrivacyPolicy = AllowIfViewerPrivacyPolicy;

  static async load<T extends HolidayBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T | null> {
    return loadEnt(viewer, id, HolidayBase.loaderOptions.apply(this));
  }

  static async loadX<T extends HolidayBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return loadEntX(viewer, id, HolidayBase.loaderOptions.apply(this));
  }

  static async loadMany<T extends HolidayBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<T[]> {
    return loadEnts(viewer, HolidayBase.loaderOptions.apply(this), ...ids);
  }

  static async loadRawData<T extends HolidayBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<Data | null> {
    return await holidayLoader.createLoader(context).load(id);
  }

  static async loadRawDataX<T extends HolidayBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<Data> {
    const row = await holidayLoader.createLoader(context).load(id);
    if (!row) {
      throw new Error(`couldn't load row for ${id}`);
    }
    return row;
  }

  static loaderOptions<T extends HolidayBase>(
    this: new (viewer: Viewer, data: Data) => T,
  ): LoadEntOptions<T> {
    return {
      tableName: tableName,
      fields: fields,
      ent: this,
      loaderFactory: holidayLoader,
    };
  }

  private static schemaFields: Map<string, Field>;

  private static getSchemaFields(): Map<string, Field> {
    if (HolidayBase.schemaFields != null) {
      return HolidayBase.schemaFields;
    }
    return (HolidayBase.schemaFields = getFields(schema));
  }

  static getField(key: string): Field | undefined {
    return HolidayBase.getSchemaFields().get(key);
  }
}

export const holidayLoader = new ObjectLoaderFactory({
  tableName,
  fields,
  key: "id",
});
