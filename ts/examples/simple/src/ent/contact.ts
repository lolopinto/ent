import { ContactBase } from "./generated/contact_base";
import {
  PrivacyPolicy,
  AllowIfViewerIsRule,
  AlwaysDenyRule,
} from "ent/core/privacy";

// we're only writing this once except with --force and packageName provided
export default class Contact extends ContactBase {
  privacyPolicy: PrivacyPolicy = {
    rules: [new AllowIfViewerIsRule("userID"), AlwaysDenyRule],
  };
}
