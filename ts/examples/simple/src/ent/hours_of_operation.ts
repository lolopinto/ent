import { AlwaysAllowPrivacyPolicy } from "@lolopinto/ent";
import { HoursOfOperationBase } from "src/ent/internal";

// we're only writing this once except with --force and packageName provided
export class HoursOfOperation extends HoursOfOperationBase {
  privacyPolicy = AlwaysAllowPrivacyPolicy;
}
