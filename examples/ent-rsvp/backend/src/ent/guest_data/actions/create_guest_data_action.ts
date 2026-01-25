import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { CreateGuestDataActionBase } from "src/ent/generated/guest_data/actions/create_guest_data_action_base";
import type { GuestDataCreateInput } from "src/ent/generated/guest_data/actions/create_guest_data_action_base";

export type { GuestDataCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateGuestDataAction extends CreateGuestDataActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
