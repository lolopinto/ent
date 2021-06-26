import {
  ID,
  Ent,
  Viewer,
  Data,
  LoadEntOptions,
  PrivacyPolicy,
} from "../../core/base";
import { loadEnt, loadEntX } from "../../core/ent";
import { AllowIfViewerIsRule, AlwaysDenyRule } from "../../core/privacy";
import { BuilderSchema, SimpleBuilder } from "../builder";
import { Field, StringType, BaseEntSchema, UUIDType } from "../../schema";
import { NodeType } from "./const";
import { table, uuid, text, timestamptz } from "../db/test_db";
import { ObjectLoaderFactory } from "../../core/loaders";
import { convertDate } from "../../core/convert";

export class FakeContact implements Ent {
  readonly id: ID;
  readonly data: Data;
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

  constructor(public viewer: Viewer, data: Data) {
    this.data = data;
    this.id = data.id;
    this.createdAt = convertDate(data.created_at);
    this.updatedAt = convertDate(data.updated_at);
    this.firstName = data.first_name;
    this.lastName = data.last_name;
    this.emailAddress = data.email_address;
    this.userID = data.user_id;
  }

  static getFields(): string[] {
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
      loaderFactory: new ObjectLoaderFactory({
        tableName: "fake_contacts",
        key: "id",
        fields: FakeContact.getFields(),
      }),
    };
  }
  static async load(v: Viewer, id: ID): Promise<FakeContact | null> {
    return loadEnt(v, id, FakeContact.loaderOptions());
  }

  static async loadX(v: Viewer, id: ID): Promise<FakeContact> {
    return loadEntX(v, id, FakeContact.loaderOptions());
  }
}

export class FakeContactSchema
  extends BaseEntSchema
  implements BuilderSchema<FakeContact>
{
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
  //To lock in the value of Date now incase of advanceTo/advanceBy
  m.set("createdAt", new Date());
  m.set("updatedAt", new Date());

  return new SimpleBuilder(viewer, new FakeContactSchema(), m);
}

export async function createContact(viewer: Viewer, input: ContactCreateInput) {
  const builder = getContactBuilder(viewer, input);
  return await builder.saveX();
}

export const contactLoader = new ObjectLoaderFactory({
  tableName: "fake_contacts",
  fields: FakeContact.getFields(),
  key: "id",
});
