import { DeleteAddressActionBase } from "src/ent/address/actions/generated/delete_address_action_base";
import { EditAddressPrivacy } from "src/ent/address/actions/privacy/edit_address_privacy";

// we're only writing this once except with --force and packageName provided
export default class DeleteAddressAction extends DeleteAddressActionBase {
  getPrivacyPolicy() {
    return new EditAddressPrivacy(this.builder);
  }
}
