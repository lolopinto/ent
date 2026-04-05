import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { EditGuestDataActionBase } from "src/ent/generated/guest_data/actions/edit_guest_data_action_base";
import type { GuestDataEditInput } from "src/ent/generated/guest_data/actions/edit_guest_data_action_base";

export type { GuestDataEditInput };

// we're only writing this once except with --force and packageName provided
export default class EditGuestDataAction extends EditGuestDataActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
