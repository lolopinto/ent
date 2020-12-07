import {
  EditEmailAddressActionBase,
  UserEditInput,
} from "src/ent/user/actions/generated/edit_email_address_action_base";

export { UserEditInput };

// we're only writing this once except with --force and packageName provided
export default class EditEmailAddressAction extends EditEmailAddressActionBase {}
