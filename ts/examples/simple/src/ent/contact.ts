import { ObjectType } from "type-graphql";
import { ContactBase } from "./generated/contact_base";
import {
  PrivacyPolicy,
  AllowIfViewerIsRule,
  AlwaysDenyRule,
} from "ent/privacy";

// we're only writing this once except with --force and packageName provided
@ObjectType()
export default class Contact extends ContactBase {
  privacyPolicy: PrivacyPolicy = {
    rules: [new AllowIfViewerIsRule("userID"), AlwaysDenyRule],
  };
}
