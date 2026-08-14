import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { DeleteGuestDataActionBase } from "../../generated/guest_data/actions/delete_guest_data_action_base.js";

// we're only writing this once except with --force and packageName provided
export default class DeleteGuestDataAction extends DeleteGuestDataActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
