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
import schema from "src/schema/hours_of_operation";

const tableName = "hours_of_operations";

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
  readonly open: Date;
  readonly close: Date;

  constructor(public viewer: Viewer, id: ID, data: Data) {
    this.id = id;
    // TODO don't double read id
    this.id = data.id;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.dayOfWeek = data.day_of_week;
    this.open = data.open;
    this.close = data.close;
  }

  // by default, we always deny and it's up to the ent
  // to overwrite this privacy policy in its subclasses

  privacyPolicy: PrivacyPolicy = {
    rules: [AllowIfViewerRule, AlwaysDenyRule],
  };

  static async load<T extends HoursOfOperationBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T | null> {
    return loadEnt(viewer, id, HoursOfOperationBase.loaderOptions.apply(this));
  }

  static async loadX<T extends HoursOfOperationBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return loadEntX(viewer, id, HoursOfOperationBase.loaderOptions.apply(this));
  }

  static async loadMany<T extends HoursOfOperationBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
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
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    id: ID,
  ): Promise<Data | null> {
    return await loadRow({
      ...HoursOfOperationBase.loaderOptions.apply(this),
      clause: query.Eq("id", id),
    });
  }

  static async loadRawDataX<T extends HoursOfOperationBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    id: ID,
  ): Promise<Data> {
    return await loadRowX({
      ...HoursOfOperationBase.loaderOptions.apply(this),
      clause: query.Eq("id", id),
    });
  }

  static loaderOptions<T extends HoursOfOperationBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
  ): LoadEntOptions<T> {
    return {
      tableName: tableName,
      fields: HoursOfOperationBase.getFields(),
      ent: this,
    };
  }

  private static getFields(): string[] {
    return ["id", "created_at", "updated_at", "day_of_week", "open", "close"];
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
