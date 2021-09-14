import { ContactBase } from "./internal";
import {
  PrivacyPolicy,
  AllowIfViewerIsRule,
  AlwaysDenyRule,
} from "@snowtop/ent";
import { gqlField } from "@snowtop/ent/graphql";

// we're only writing this once except with --force and packageName provided
export class Contact extends ContactBase {
  privacyPolicy: PrivacyPolicy = {
    rules: [new AllowIfViewerIsRule("userID"), AlwaysDenyRule],
  };

  @gqlField()
  get fullName(): string {
    return this.firstName + " " + this.lastName;
  }
}
