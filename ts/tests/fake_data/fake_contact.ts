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
      tableName: "contacts",
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
