import { AlwaysAllowPrivacyPolicy, PrivacyPolicy } from "@snowtop/ent";
import { HoursOfOperationBase } from "./internal.js";

// we're only writing this once except with --force and packageName provided
export class HoursOfOperation extends HoursOfOperationBase {
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return AlwaysAllowPrivacyPolicy;
  }
}
