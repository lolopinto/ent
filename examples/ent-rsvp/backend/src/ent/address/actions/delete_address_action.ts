import { DeleteAddressActionBase } from "../../generated/address/actions/delete_address_action_base.js";
import { EditAddressPrivacy } from "./privacy/edit_address_privacy.js";

// we're only writing this once except with --force and packageName provided
export default class DeleteAddressAction extends DeleteAddressActionBase {
  getPrivacyPolicy() {
    return new EditAddressPrivacy(this.builder);
  }
}
