import {
  EditAddressActionBase,
  AddressEditInput,
} from "src/ent/address/actions/generated/edit_address_action_base";
import { EditAddressPrivacy } from "src/ent/address/actions/privacy/edit_address_privacy";
export { AddressEditInput };

// we're only writing this once except with --force and packageName provided
export default class EditAddressAction extends EditAddressActionBase {
  getPrivacyPolicy() {
    return new EditAddressPrivacy(this.builder);
  }
}
