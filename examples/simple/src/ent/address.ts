import { AlwaysAllowPrivacyPolicy, PrivacyPolicy } from "@snowtop/ent";
import { AddressBase } from "./internal.js";

// we're only writing this once except with --force and packageName provided
export class Address extends AddressBase {
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return AlwaysAllowPrivacyPolicy;
  }
}
