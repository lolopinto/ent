import { AllowIfEntIsVisiblePolicy, PrivacyPolicy } from "@snowtop/ent";
import { AddressBase } from "src/ent/internal";
import { getLoaderOptions } from "./generated/loadAny";
import { NodeType } from "./generated/types";

// we're only writing this once except with --force and packageName provided
export class Address extends AddressBase {
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return new AllowIfEntIsVisiblePolicy(
      this.ownerID,
      getLoaderOptions(this.ownerType as NodeType),
    );
  }
}
