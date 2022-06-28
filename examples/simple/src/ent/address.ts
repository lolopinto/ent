import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { AddressBase } from "./internal";

// we're only writing this once except with --force and packageName provided
export class Address extends AddressBase {
  privacyPolicy = AlwaysAllowPrivacyPolicy;
}
