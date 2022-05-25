import {
  CreateContactActionBase,
  ContactCreateInput,
} from "../../generated/contact/actions/create_contact_action_base";

export { ContactCreateInput };
import { Contact, ContactEmail, ContactPhoneNumber } from "../../";
// TODO...
import { EntCreationObserver } from "@snowtop/ent/testutils/fake_log";
import {
  AllowIfViewerEqualsRule,
  AllowIfViewerRule,
  AlwaysDenyRule,
  PrivacyPolicy,
  Data,
  IDViewer,
} from "@snowtop/ent";
import { AllowIfBuilder, Observer, Trigger } from "@snowtop/ent/action";
import CreateContactEmailAction from "../../../ent/contact_email/actions/create_contact_email_action";
import { ContactBuilder } from "../../generated/contact/actions/contact_builder";
import CreateContactPhoneNumberAction from "../../../ent/contact_phone_number/actions/create_contact_phone_number_action";
import EditContactAction from "./edit_contact_action";

// we're only writing this once except with --force and packageName provided
export default class CreateContactAction extends CreateContactActionBase {
  getPrivacyPolicy(): PrivacyPolicy {
    return {
      rules: [
        AllowIfViewerRule,
        new AllowIfViewerEqualsRule(this.input.userID),
        new AllowIfBuilder(this.input.userID),
        AlwaysDenyRule,
      ],
    };
  }

  triggers: Trigger<ContactBuilder, ContactCreateInput>[] = [
    {
      async changeset(builder, input) {
        if (input.emails) {
          const emailActions: CreateContactEmailAction[] = [];
          const changesets = input.emails.map(async (email) => {
            const action = CreateContactEmailAction.create(builder.viewer, {
              emailAddress: email.emailAddress,
              label: email.label,
              contactID: builder,
            });
            emailActions.push(action);
            return action.changeset();
          });

          builder.storeData("emailActions", emailActions);
          return Promise.all(changesets);
        }
      },
    },
    {
      async changeset(builder, input) {
        if (input.phoneNumbers) {
          const phoneActions: CreateContactPhoneNumberAction[] = [];
          const changesets = input.phoneNumbers.map(async (phone) => {
            const action = CreateContactPhoneNumberAction.create(
              builder.viewer,
              {
                phoneNumber: phone.phoneNumber,
                label: phone.label,
                contactID: builder,
              },
            );
            phoneActions.push(action);
            return action.changeset();
          });

          builder.storeData("phoneActions", phoneActions);
          return Promise.all(changesets);
        }
      },
    },
  ];

  observers: Observer<ContactBuilder, ContactCreateInput>[] = [
    new EntCreationObserver<Contact>(),
    {
      // TODO https://github.com/lolopinto/ent/issues/605 simplifies all this
      async observe(builder: ContactBuilder) {
        const actions: CreateContactEmailAction[] =
          builder.getStoredData("emailActions") || [];
        if (!actions.length) {
          return;
        }
        const contact = await builder.editedEntX();
        // use viewer of id for everything below...
        const viewer = new IDViewer(contact.userID);

        const ids = await Promise.all(
          actions.map(async (action) => {
            const returnedRow = await action.builder.orchestrator.returnedRow();
            if (!returnedRow) {
              throw new Error(`couldn't get returnedRow from action`);
            }

            const ent = await ContactEmail.loadX(viewer, returnedRow["id"]);
            return ent.id;
          }),
        );
        await EditContactAction.create(viewer, contact, {
          emailIds: ids,
        }).saveX();
      },
    },
    {
      async observe(builder: ContactBuilder) {
        const actions: CreateContactPhoneNumberAction[] =
          builder.getStoredData("phoneActions") || [];
        if (!actions.length) {
          return;
        }
        const contact = await builder.editedEntX();
        // use viewer of id for everything below...
        const viewer = new IDViewer(contact.userID);

        const ids = await Promise.all(
          actions.map(async (action) => {
            const returnedRow = await action.builder.orchestrator.returnedRow();
            if (!returnedRow) {
              throw new Error(`couldn't get returnedRow from action`);
            }

            const ent = await ContactPhoneNumber.loadX(
              viewer,
              returnedRow["id"],
            );
            return ent.id;
          }),
        );
        await EditContactAction.create(new IDViewer(contact.userID), contact, {
          phoneNumberIds: ids,
        }).saveX();
      },
    },
  ];

  viewerForEntLoad(data: Data) {
    // needed if created in user action and we want to make sure this
    // ent is viewable. especially bcos of EntCreationObserver
    return new IDViewer(data.user_id);
  }
}
