import { CreateAddressActionBase } from "src/ent/generated/address/actions/create_address_action_base";
import type { AddressCreateInput } from "src/ent/generated/address/actions/create_address_action_base";
import { addressOwnerPrivacy } from "./privacy/address_owner_privacy";
export type { AddressCreateInput };

export default class CreateAddressAction extends CreateAddressActionBase {
  getPrivacyPolicy() {
    return addressOwnerPrivacy(
      this.viewer,
      this.input.ownerId,
      this.input.ownerType,
    );
  }
}
