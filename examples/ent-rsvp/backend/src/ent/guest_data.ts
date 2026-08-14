import { AlwaysAllowPrivacyPolicy, PrivacyPolicy } from "@snowtop/ent";
import { GuestDataBase } from "./internal.js";

// we're only writing this once except with --force and packageName provided
export class GuestData extends GuestDataBase {
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return AlwaysAllowPrivacyPolicy;
  }
}
