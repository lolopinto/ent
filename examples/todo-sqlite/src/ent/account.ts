import { AlwaysAllowPrivacyPolicy } from "@lolopinto/ent";
import { AccountBase } from "src/ent/internal";

export class Account extends AccountBase {
  privacyPolicy = AlwaysAllowPrivacyPolicy;
}
