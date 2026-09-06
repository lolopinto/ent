import { CreateContactActionBase } from "../../generated/contact/actions/create_contact_action_base";
import { deriveContact } from "./derive_contact";

export type { ContactCreateInput } from "../../generated/contact/actions/create_contact_action_base";

export default class CreateContactAction extends CreateContactActionBase {
  getTriggers() {
    return [{ changeset: deriveContact }];
  }
}
