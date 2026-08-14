import { AlwaysAllowPrivacyPolicy, PrivacyPolicy } from "@snowtop/ent";
import { AuthCodeBase } from "./internal.js";

// we're only writing this once except with --force and packageName provided
export class AuthCode extends AuthCodeBase {
  // simplify for now since this is not exposed to production
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return AlwaysAllowPrivacyPolicy;
  }
}
