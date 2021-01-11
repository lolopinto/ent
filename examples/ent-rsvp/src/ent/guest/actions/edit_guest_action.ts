import {
  EditGuestActionBase,
  GuestEditInput,
} from "src/ent/guest/actions/generated/edit_guest_action_base";

export { GuestEditInput };

// we're only writing this once except with --force and packageName provided
export default class EditGuestAction extends EditGuestActionBase {}
