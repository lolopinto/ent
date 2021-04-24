import {
  ID,
  Ent,
  Viewer,
  Data,
  loadEnt,
  loadEntX,
  LoadEntOptions,
} from "../../core/ent";
import {
  AllowIfViewerIsRule,
  AlwaysDenyRule,
  PrivacyPolicy,
} from "../../core/privacy";
import { BuilderSchema, SimpleBuilder } from "../builder";
import { Field, StringType, BaseEntSchema, UUIDType } from "../../schema";
import { NodeType } from "./const";
import { table, uuid, text, timestamptz } from "../db/test_db";

export class FakeContact implements Ent {
  readonly id: ID;
  readonly nodeType = NodeType.FakeContact;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly firstName: string;
  readonly lastName: string;
  readonly emailAddress: string;
  readonly userID: ID;

  privacyPolicy: PrivacyPolicy = {
    rules: [new AllowIfViewerIsRule("userID"), AlwaysDenyRule],
  };

  constructor(public viewer: Viewer, id: ID, data: Data) {
    this.id = data["id"];
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.firstName = data.first_name;
    this.lastName = data.last_name;
    this.emailAddress = data.email_address;
    this.userID = data.user_id;
  }

  private static getFields(): string[] {
    return [
      "id",
      "created_at",
      "updated_at",
      "first_name",
      "last_name",
      "email_address",
      "user_id",
    ];
  }

  static getTestTable() {
    return table(
      "fake_contacts",
      uuid("id", { primaryKey: true }),
      timestamptz("created_at"),
      timestamptz("updated_at"),
      text("first_name"),
      text("last_name"),
      text("email_address"),
      uuid("user_id"),
    );
  }

  static loaderOptions(): LoadEntOptions<FakeContact> {
    return {
      tableName: "fake_contacts",
      fields: FakeContact.getFields(),
      ent: this,
    };
  }
  static async load(v: Viewer, id: ID): Promise<FakeContact | null> {
    return loadEnt(v, id, FakeContact.loaderOptions());
  }

  static async loadX(v: Viewer, id: ID): Promise<FakeContact> {
    return loadEntX(v, id, FakeContact.loaderOptions());
  }
}

export class FakeContactSchema extends BaseEntSchema
  implements BuilderSchema<FakeContact> {
  ent = FakeContact;
  fields: Field[] = [
    StringType({
      name: "firstName",
    }),
    StringType({
      name: "lastName",
    }),
    StringType({
      name: "emailAddress",
    }),
    UUIDType({
      name: "userID",
      foreignKey: { schema: "User", column: "ID" },
    }),
  ];
}

export interface ContactCreateInput {
  firstName: string;
  lastName: string;
  emailAddress: string;
  userID: ID;
}

export function getContactBuilder(viewer: Viewer, input: ContactCreateInput) {
  const m = new Map();
  for (const key in input) {
    m.set(key, input[key]);
  }
  return new SimpleBuilder(viewer, new FakeContactSchema(), m);
}

export async function createContact(viewer: Viewer, input: ContactCreateInput) {
  const builder = getContactBuilder(viewer, input);
  return await builder.saveX();
}
