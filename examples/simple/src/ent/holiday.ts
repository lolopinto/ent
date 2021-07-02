import { AlwaysAllowPrivacyPolicy } from "@snowtop/snowtop-ts";
import { HolidayBase } from "src/ent/internal";

// we're only writing this once except with --force and packageName provided
export class Holiday extends HolidayBase {
  privacyPolicy = AlwaysAllowPrivacyPolicy;
}
