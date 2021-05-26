import { AlwaysAllowPrivacyPolicy } from "@lolopinto/ent";
import { AddressBase } from "src/ent/internal";

// we're only writing this once except with --force and packageName provided
export class Address extends AddressBase {
  privacyPolicy = AlwaysAllowPrivacyPolicy;
}
