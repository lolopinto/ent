import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { UserBase } from "./generated/user_base";

export class User extends UserBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
