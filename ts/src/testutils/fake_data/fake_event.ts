import {
  ID,
  Ent,
  Viewer,
  Data,
  LoadEntOptions,
  PrivacyPolicy,
} from "../../core/base";
import { loadEnt, loadEntX } from "../../core/ent";
import { AlwaysAllowPrivacyPolicy } from "../../core/privacy";
import { getBuilderSchemaFromFields, SimpleBuilder } from "../builder";
import { StringType, UUIDType, TimestampType } from "../../schema";
import { NodeType } from "./const";
import { table, uuid, text, timestamptz } from "../db/temp_db";
import { ObjectLoaderFactory } from "../../core/loaders";
import { convertDate, convertNullableDate } from "../../core/convert";
import { WriteOperation } from "../../action";

export class FakeEvent implements Ent {
  readonly id: ID;
  readonly data: Data;
  readonly nodeType = NodeType.FakeEvent;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly startTime: Date;
  readonly endTime: Date | null;
  readonly location: string;
  readonly title: string;
  readonly description: string | null;
  readonly userID: ID;

  getPrivacyPolicy(): PrivacyPolicy<this> {
    return AlwaysAllowPrivacyPolicy;
  }

  constructor(public viewer: Viewer, data: Data) {
    this.data = data;
    this.id = data.id;
    this.createdAt = convertDate(data.created_at);
    this.updatedAt = convertDate(data.updated_at);
    this.startTime = convertDate(data.start_time);
    this.endTime = convertNullableDate(data.end_time);
    this.location = data.location;
    this.title = data.title;
    this.description = data.description;
    this.userID = data.user_id;
  }

  private static getFields(): string[] {
    return [
      "id",
      "created_at",
      "updated_at",
      "start_time",
      "end_time",
      "location",
      "title",
      "description",
      "user_id",
    ];
  }

  static getTestTable() {
    return table(
      "fake_events",
      uuid("id", { primaryKey: true }),
      timestamptz("created_at"),
      timestamptz("updated_at"),
      // TODO index:true
      timestamptz("start_time"),
      timestamptz("end_time", { nullable: true }),
      text("location"),
      text("title"),
      text("description", { nullable: true }),
      uuid("user_id"),
    );
  }

  static loaderOptions(): LoadEntOptions<FakeEvent> {
    return {
      tableName: "fake_events",
      fields: FakeEvent.getFields(),
      ent: this,
      loaderFactory: new ObjectLoaderFactory({
        tableName: "fake_events",
        key: "id",
        fields: FakeEvent.getFields(),
      }),
    };
  }
  static async load(v: Viewer, id: ID): Promise<FakeEvent | null> {
    return loadEnt(v, id, FakeEvent.loaderOptions());
  }

  static async loadX(v: Viewer, id: ID): Promise<FakeEvent> {
    return loadEntX(v, id, FakeEvent.loaderOptions());
  }
}

export const FakeEventSchema = getBuilderSchemaFromFields(
  {
    startTime: TimestampType({
      index: true,
    }),
    endTime: TimestampType({
      nullable: true,
    }),
    title: StringType(),
    location: StringType(),
    description: StringType({
      nullable: true,
    }),
    userID: UUIDType({
      foreignKey: { schema: "User", column: "ID" },
    }),
  },
  FakeEvent,
);

export interface EventCreateInput {
  startTime: Date;
  endTime?: Date | null;
  location: string;
  title: string;
  description?: string | null;
  userID: ID;
}

export function getEventBuilder(viewer: Viewer, input: EventCreateInput) {
  const m = new Map();
  for (const key in input) {
    m.set(key, input[key]);
  }
  return new SimpleBuilder(
    viewer,
    FakeEventSchema,
    m,
    WriteOperation.Insert,
    null,
  );
}

export async function createEvent(viewer: Viewer, input: EventCreateInput) {
  const builder = getEventBuilder(viewer, input);
  return await builder.saveX();
}
