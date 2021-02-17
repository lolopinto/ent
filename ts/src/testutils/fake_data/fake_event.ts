import {
  ID,
  Ent,
  Viewer,
  Data,
  loadEnt,
  loadEntX,
  LoadEntOptions,
} from "../../core/ent";
import { AlwaysAllowRule, PrivacyPolicy } from "../../core/privacy";
import { BuilderSchema, SimpleBuilder } from "../builder";
import {
  Field,
  StringType,
  BaseEntSchema,
  UUIDType,
  TimestampType,
} from "../../schema";
import { NodeType } from "./const";

export class FakeEvent implements Ent {
  readonly id: ID;
  readonly nodeType = NodeType.FakeEvent;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly startTime: Date;
  readonly endTime: Date | null;
  readonly location: string;
  readonly title: string;
  readonly description: string | null;
  readonly userID: ID;

  privacyPolicy: PrivacyPolicy = {
    rules: [AlwaysAllowRule],
  };

  constructor(public viewer: Viewer, id: ID, data: Data) {
    this.id = data["id"];
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.startTime = data.start_time;
    this.endTime = data.end_time;
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

  static loaderOptions(): LoadEntOptions<FakeEvent> {
    return {
      tableName: "fake_events",
      fields: FakeEvent.getFields(),
      ent: this,
    };
  }
  static async load(v: Viewer, id: ID): Promise<FakeEvent | null> {
    return loadEnt(v, id, FakeEvent.loaderOptions());
  }

  static async loadX(v: Viewer, id: ID): Promise<FakeEvent> {
    return loadEntX(v, id, FakeEvent.loaderOptions());
  }
}

export class FakeEventSchema extends BaseEntSchema
  implements BuilderSchema<FakeEvent> {
  ent = FakeEvent;
  fields: Field[] = [
    TimestampType({
      name: "startTime",
    }),
    TimestampType({
      name: "endTime",
      nullable: true,
    }),
    StringType({
      name: "title",
    }),
    StringType({
      name: "location",
    }),
    StringType({
      name: "description",
      nullable: true,
    }),
    UUIDType({
      name: "userID",
      foreignKey: { schema: "User", column: "ID" },
    }),
  ];
}

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
  return new SimpleBuilder(viewer, new FakeEventSchema(), m);
}

export async function createEvent(viewer: Viewer, input: EventCreateInput) {
  const builder = getEventBuilder(viewer, input);
  return await builder.saveX();
}
