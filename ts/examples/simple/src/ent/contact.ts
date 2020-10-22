import { ContactBase } from "src/ent/internal";
import {
  PrivacyPolicy,
  AllowIfViewerIsRule,
  AlwaysDenyRule,
} from "@lolopinto/ent";

// we're only writing this once except with --force and packageName provided
export class Contact extends ContactBase {
  privacyPolicy: PrivacyPolicy = {
    rules: [new AllowIfViewerIsRule("userID"), AlwaysDenyRule],
  };
}
