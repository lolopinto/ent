import {
  AllowIfViewerIsRule,
  AlwaysDenyRule,
  PrivacyPolicy,
} from "@snowtop/ent";
import { AuthCodeBase } from "../ent/internal";

// we're only writing this once except with --force and packageName provided
export class AuthCode extends AuthCodeBase {
  privacyPolicy: PrivacyPolicy = {
    rules: [new AllowIfViewerIsRule("userID"), AlwaysDenyRule],
  };
}
