import {
  CreateContactActionBase,
  ContactCreateInput,
} from "src/ent/contact/actions/generated/create_contact_action_base";

export { ContactCreateInput };
import Contact from "src/ent/contact";
// TODO...
import { EntCreationObserver } from "@lolopinto/ent/testutils/fake_log";

// we're only writing this once except with --force and packageName provided
export default class CreateContactAction extends CreateContactActionBase {
  observers = [new EntCreationObserver<Contact>()];
}
