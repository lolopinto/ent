import { AlwaysAllowPrivacyPolicy, PrivacyPolicy } from "@snowtop/ent";
import { TagBase } from "src/ent/internal";

export class Tag extends TagBase {
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return AlwaysAllowPrivacyPolicy;
  }
}
