import {
  ID,
  Ent,
  Viewer,
  Data,
  loadEnt,
  loadEntX,
  LoadEntOptions,
} from "../../src/core/ent";
import {
  AllowIfViewerIsRule,
  AlwaysDenyRule,
  PrivacyPolicy,
} from "../../src/core/privacy";
import { BaseEdgeQuery, EdgeQuerySource } from "../../src/core/query";
import { createRowForTest, snakeAll } from "../../src/testutils/write";
import { BuilderSchema, SimpleBuilder } from "../../src/testutils/builder";
import { Field, StringType, BaseEntSchema, UUIDType } from "../../src/schema";

export class FakeContact implements Ent {
  readonly id: ID;
  readonly nodeType = "Contact";
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

export class BaseContactDestQuery<TSource extends Ent> extends BaseEdgeQuery<
  TSource,
  FakeContact
> {}
