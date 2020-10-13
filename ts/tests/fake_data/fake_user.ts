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
      tableName: "users",
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
