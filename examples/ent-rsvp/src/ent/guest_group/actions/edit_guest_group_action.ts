import {
  EditGuestGroupActionBase,
  GuestGroupEditInput,
} from "src/ent/guest_group/actions/generated/edit_guest_group_action_base";

export { GuestGroupEditInput };

// we're only writing this once except with --force and packageName provided
export default class EditGuestGroupAction extends EditGuestGroupActionBase {}
