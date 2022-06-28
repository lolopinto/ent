import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { HoursOfOperationBase } from "./internal";

// we're only writing this once except with --force and packageName provided
export class HoursOfOperation extends HoursOfOperationBase {
  privacyPolicy = AlwaysAllowPrivacyPolicy;
}
