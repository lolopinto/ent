import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { AuthCodeBase } from "src/ent/internal";

// we're only writing this once except with --force and packageName provided
export class AuthCode extends AuthCodeBase {
  // simplify for now since this is not exposed to production
  privacyPolicy = AlwaysAllowPrivacyPolicy;
}
