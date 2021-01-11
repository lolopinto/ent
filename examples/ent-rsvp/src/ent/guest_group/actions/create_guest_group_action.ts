import {
  CreateGuestGroupActionBase,
  GuestGroupCreateInput,
} from "src/ent/guest_group/actions/generated/create_guest_group_action_base";

export { GuestGroupCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateGuestGroupAction extends CreateGuestGroupActionBase {}
