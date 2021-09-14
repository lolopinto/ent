import {
  EditContactActionBase,
  ContactEditInput,
} from "./generated/edit_contact_action_base";

export { ContactEditInput };

// we're only writing this once except with --force and packageName provided
export default class EditContactAction extends EditContactActionBase {}
