import { AlwaysAllowPrivacyPolicy, PrivacyPolicy } from "@lolopinto/ent";
import { TagBase } from "src/ent/internal";

export class Tag extends TagBase {
  privacyPolicy: PrivacyPolicy = AlwaysAllowPrivacyPolicy;
}
