import { AlwaysAllowPrivacyPolicy, PrivacyPolicy } from "@snowtop/snowtop-ts";
import { TagBase } from "src/ent/internal";

export class Tag extends TagBase {
  privacyPolicy: PrivacyPolicy = AlwaysAllowPrivacyPolicy;
}
