import {
  CreateGuestActionBase,
  GuestCreateInput,
} from "src/ent/guest/actions/generated/create_guest_action_base";

export { GuestCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateGuestAction extends CreateGuestActionBase {}
