import { EditAddressActionBase } from "../../generated/address/actions/edit_address_action_base.js";
import type { AddressEditInput } from "../../generated/address/actions/edit_address_action_base.js";
import { EditAddressPrivacy } from "./privacy/edit_address_privacy.js";
export type { AddressEditInput };

// we're only writing this once except with --force and packageName provided
export default class EditAddressAction extends EditAddressActionBase {
  getPrivacyPolicy() {
    return new EditAddressPrivacy(this.builder);
  }
}
