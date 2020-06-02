import { ContactBase } from "./generated/contact_base";
import { ContactLoader } from "./generated/loaders";
import {
  PrivacyPolicy,
  AllowIfViewerIsRule,
  AlwaysDenyRule,
} from "ent/privacy";

// we're only writing this once except with --force and packageName provided
export default class Contact extends ContactBase {
  privacyPolicy: PrivacyPolicy = {
    rules: [new AllowIfViewerIsRule("userID"), AlwaysDenyRule],
  };
}
ContactLoader.registerClass(Contact);
