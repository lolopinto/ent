import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import {
  CreateGuestDataActionBase,
  GuestDataCreateInput,
} from "src/ent/guest_data/actions/generated/create_guest_data_action_base";

export { GuestDataCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateGuestDataAction extends CreateGuestDataActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
