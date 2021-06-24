import { AlwaysAllowPrivacyPolicy } from "@snowtop/snowtop-ts";
import { AccountBase } from "src/ent/internal";

export class Account extends AccountBase {
  privacyPolicy = AlwaysAllowPrivacyPolicy;
}
