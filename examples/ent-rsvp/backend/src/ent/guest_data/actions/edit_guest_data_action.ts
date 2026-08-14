import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { EditGuestDataActionBase } from "../../generated/guest_data/actions/edit_guest_data_action_base.js";
import type { GuestDataEditInput } from "../../generated/guest_data/actions/edit_guest_data_action_base.js";

export type { GuestDataEditInput };

// we're only writing this once except with --force and packageName provided
export default class EditGuestDataAction extends EditGuestDataActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
