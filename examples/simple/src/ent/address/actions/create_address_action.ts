import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { CreateAddressActionBase } from "../../generated/address/actions/create_address_action_base.js";
import type { AddressCreateInput } from "../../generated/address/actions/create_address_action_base.js";
export type { AddressCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateAddressAction extends CreateAddressActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
