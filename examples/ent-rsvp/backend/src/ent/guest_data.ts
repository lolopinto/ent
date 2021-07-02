import { AlwaysAllowPrivacyPolicy } from "@snowtop/snowtop-ts";
import { GuestDataBase } from "src/ent/internal";

// we're only writing this once except with --force and packageName provided
export class GuestData extends GuestDataBase {
  privacyPolicy = AlwaysAllowPrivacyPolicy;
}
