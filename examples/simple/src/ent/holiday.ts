import { AlwaysAllowPrivacyPolicy, PrivacyPolicy } from "@snowtop/ent";
import { HolidayBase } from "./internal.js";

// we're only writing this once except with --force and packageName provided
export class Holiday extends HolidayBase {
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return AlwaysAllowPrivacyPolicy;
  }
}
