import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { CreateAddressActionBase } from "../../generated/address/actions/create_address_action_base";
import type { AddressCreateInput } from "../../generated/address/actions/create_address_action_base";
export type { AddressCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateAddressAction extends CreateAddressActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
