import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { ContactBase } from "./internal";

export class Contact extends ContactBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
