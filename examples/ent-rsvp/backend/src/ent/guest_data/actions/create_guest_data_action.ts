import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { CreateGuestDataActionBase } from "../../generated/guest_data/actions/create_guest_data_action_base.js";
import type { GuestDataCreateInput } from "../../generated/guest_data/actions/create_guest_data_action_base.js";

export type { GuestDataCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateGuestDataAction extends CreateGuestDataActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
