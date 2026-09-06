import { EditContactActionBase } from "../../generated/contact/actions/edit_contact_action_base";
import { deriveContact } from "./derive_contact";

export type { ContactEditInput } from "../../generated/contact/actions/edit_contact_action_base";

export default class EditContactAction extends EditContactActionBase {
  getTriggers() {
    return [{ changeset: deriveContact }];
  }
}
