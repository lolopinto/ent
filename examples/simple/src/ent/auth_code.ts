import {
  AllowIfViewerIsEntPropertyRule,
  AlwaysDenyRule,
  PrivacyPolicy,
} from "@snowtop/ent";
import { AuthCodeBase } from "./internal.js";

// we're only writing this once except with --force and packageName provided
export class AuthCode extends AuthCodeBase {
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return {
      rules: [new AllowIfViewerIsEntPropertyRule("userId"), AlwaysDenyRule],
    };
  }
}
