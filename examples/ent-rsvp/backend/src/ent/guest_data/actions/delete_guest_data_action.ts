import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { DeleteGuestDataActionBase } from "src/ent/guest_data/actions/generated/delete_guest_data_action_base";

// we're only writing this once except with --force and packageName provided
export default class DeleteGuestDataAction extends DeleteGuestDataActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
