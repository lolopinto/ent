import { AllowIfEntIsVisiblePolicy, PrivacyPolicy } from "@snowtop/snowtop-ts";
import { AddressBase, NodeType } from "src/ent/internal";
import { getLoaderOptions } from "./loadAny";

// we're only writing this once except with --force and packageName provided
export class Address extends AddressBase {
  privacyPolicy: PrivacyPolicy = new AllowIfEntIsVisiblePolicy(
    this.ownerID,
    getLoaderOptions(this.ownerType as NodeType),
  );
}
