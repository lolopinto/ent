import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import {
  EditGuestDataActionBase,
  GuestDataEditInput,
} from "src/ent/guest_data/actions/generated/edit_guest_data_action_base";

export { GuestDataEditInput };

// we're only writing this once except with --force and packageName provided
export default class EditGuestDataAction extends EditGuestDataActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
