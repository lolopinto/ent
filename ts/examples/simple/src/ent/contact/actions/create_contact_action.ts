import {
  CreateContactActionBase,
  ContactCreateInput,
} from "src/ent/contact/actions/generated/create_contact_action_base";

export { ContactCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateContactAction extends CreateContactActionBase {}
