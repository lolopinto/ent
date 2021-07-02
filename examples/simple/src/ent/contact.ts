import { ContactBase } from "src/ent/internal";
import {
  PrivacyPolicy,
  AllowIfViewerIsRule,
  AlwaysDenyRule,
} from "@snowtop/snowtop-ts";
import { gqlField } from "@snowtop/snowtop-ts/graphql";

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
