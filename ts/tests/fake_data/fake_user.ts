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
  AllowIfViewerRule,
  AlwaysDenyRule,
  PrivacyPolicy,
} from "../../src/core/privacy";
import { BaseEdgeQuery, EdgeQuerySource } from "../../src/core/query";
import { FakeContact, BaseContactDestQuery } from "./fake_contact";
import { EdgeType } from "./const";
import { createRowForTest, snakeAll } from "../../src/testutils/write";
import { BuilderSchema, SimpleBuilder } from "../../src/testutils/builder";
import { Field, StringType, BaseEntSchema } from "../../src/schema";

export class FakeUser implements Ent {
  readonly id: ID;
  readonly nodeType = "User";
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly firstName: string;
  readonly lastName: string;
  readonly emailAddress: string;
  readonly phoneNumber: string | null;
  protected readonly password: string | null;

  privacyPolicy: PrivacyPolicy = {
    rules: [AllowIfViewerRule, AlwaysDenyRule],
  };

  constructor(public viewer: Viewer, id: ID, data: Data) {
    this.id = data["id"];
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.firstName = data.first_name;
    this.lastName = data.last_name;
    this.emailAddress = data.email_address;
    this.phoneNumber = data.phone_number;
    this.password = data.password;
  }

  private static getFields(): string[] {
    return [
      "id",
      "created_at",
      "updated_at",
      "first_name",
      "last_name",
      "email_address",
      "phone_number",
      "password",
    ];
  }

  static loaderOptions(): LoadEntOptions<FakeUser> {
    return {
      tableName: "fake_users",
      fields: FakeUser.getFields(),
      ent: this,
    };
  }
  static async load(v: Viewer, id: ID): Promise<FakeUser | null> {
    return loadEnt(v, id, FakeUser.loaderOptions());
  }

  static async loadX(v: Viewer, id: ID): Promise<FakeUser> {
    return loadEntX(v, id, FakeUser.loaderOptions());
  }
}

export class FakeUserSchema extends BaseEntSchema
  implements BuilderSchema<FakeUser> {
  ent = FakeUser;
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
    StringType({
      name: "phoneNumber",
    }),
    StringType({
      name: "password",
      nullable: true,
    }),
  ];
}

export class BaseUserDestQuery<TSource extends Ent> extends BaseEdgeQuery<
  TSource,
  FakeUser
> {}

export class UserToContactsQuery extends BaseContactDestQuery<FakeUser> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeUser>) {
    super(viewer, src, EdgeType.UserToContacts, FakeContact.loaderOptions());
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<FakeUser>,
  ): UserToContactsQuery {
    return new UserToContactsQuery(viewer, src);
  }
}

export interface UserCreateInput {
  firstName: string;
  lastName: string;
  emailAddress: string;
  phoneNumber: string | null;
  password: string | null;
}

export type UserEditInput = Partial<UserCreateInput>;

export function getUserBuilder(viewer: Viewer, input: UserCreateInput) {
  const m = new Map();
  for (const key in input) {
    m.set(key, input[key]);
  }
  return new SimpleBuilder(viewer, new FakeUserSchema(), m);
}

export async function createUser(viewer: Viewer, input: UserCreateInput) {
  const builder = getUserBuilder(viewer, input);
  return await builder.saveX();
}
