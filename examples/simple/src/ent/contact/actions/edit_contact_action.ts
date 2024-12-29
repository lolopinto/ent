import { ContactEmail } from "../../../ent";
import {
  EditContactActionBase,
  ContactEditInput,
  EditContactActionTriggers,
} from "../../generated/contact/actions/edit_contact_action_base";
import EditContactEmailAction from "../../../ent/contact_email/actions/edit_contact_email_action";

export { ContactEditInput };

// we're only writing this once except with --force and packageName provided
export default class EditContactAction extends EditContactActionBase {
  getTriggers(): EditContactActionTriggers {
    return [
      {
        async changeset(builder, input) {
          if (!input.emails) {
            return;
          }
          return Promise.all(
            input.emails.map(async (emailInput) => {
              const email = await ContactEmail.loadX(
                builder.viewer,
                emailInput.id,
              );
              return EditContactEmailAction.create(builder.viewer, email, {
                ...emailInput,
              }).changeset();
            }),
          );
        },
      },
    ];
  }
}
