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
import schema from "src/schema/hours_of_operation";

const tableName = "hours_of_operations";
const fields = [
  "id",
  "created_at",
  "updated_at",
  "day_of_week",
  "open",
  "close",
];

export enum dayOfWeek {
  Sunday = "Sunday",
  Monday = "Monday",
  Tuesday = "Tuesday",
  Wednesday = "Wednesday",
  Thursday = "Thursday",
  Friday = "Friday",
  Saturday = "Saturday",
}

export function getDayOfWeekValues() {
  return [
    dayOfWeek.Sunday,
    dayOfWeek.Monday,
    dayOfWeek.Tuesday,
    dayOfWeek.Wednesday,
    dayOfWeek.Thursday,
    dayOfWeek.Friday,
    dayOfWeek.Saturday,
  ];
}

export class HoursOfOperationBase {
  readonly nodeType = NodeType.HoursOfOperation;
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly dayOfWeek: dayOfWeek;
  readonly open: string;
  readonly close: string;

  constructor(public viewer: Viewer, data: Data) {
    this.id = data.id;
    this.createdAt = convertDate(data.created_at);
    this.updatedAt = convertDate(data.updated_at);
    this.dayOfWeek = data.day_of_week;
    this.open = data.open;
    this.close = data.close;
  }

  // default privacyPolicy is Viewer can see themselves
  privacyPolicy: PrivacyPolicy = AllowIfViewerPrivacyPolicy;

  static async load<T extends HoursOfOperationBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T | null> {
    return loadEnt(viewer, id, HoursOfOperationBase.loaderOptions.apply(this));
  }

  static async loadX<T extends HoursOfOperationBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return loadEntX(viewer, id, HoursOfOperationBase.loaderOptions.apply(this));
  }

  static async loadMany<T extends HoursOfOperationBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<T[]> {
    return loadEnts(
      viewer,
      HoursOfOperationBase.loaderOptions.apply(this),
      ...ids,
    );
  }

  static async loadRawData<T extends HoursOfOperationBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<Data | null> {
    return await hoursOfOperationLoader.createLoader(context).load(id);
  }

  static async loadRawDataX<T extends HoursOfOperationBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<Data> {
    const row = await hoursOfOperationLoader.createLoader(context).load(id);
    if (!row) {
      throw new Error(`couldn't load row for ${id}`);
    }
    return row;
  }

  static loaderOptions<T extends HoursOfOperationBase>(
    this: new (viewer: Viewer, data: Data) => T,
  ): LoadEntOptions<T> {
    return {
      tableName: tableName,
      fields: fields,
      ent: this,
      loaderFactory: hoursOfOperationLoader,
    };
  }

  private static schemaFields: Map<string, Field>;

  private static getSchemaFields(): Map<string, Field> {
    if (HoursOfOperationBase.schemaFields != null) {
      return HoursOfOperationBase.schemaFields;
    }
    return (HoursOfOperationBase.schemaFields = getFields(schema));
  }

  static getField(key: string): Field | undefined {
    return HoursOfOperationBase.getSchemaFields().get(key);
  }
}

export const hoursOfOperationLoader = new ObjectLoaderFactory({
  tableName,
  fields,
  key: "id",
});
