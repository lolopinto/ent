import {
  CreateContactActionBase,
  ContactCreateInput,
} from "../../generated/contact/actions/create_contact_action_base";

export { ContactCreateInput };
import { Contact } from "../../";
// TODO...
import { EntCreationObserver } from "@snowtop/ent/testutils/fake_log";
import {
  AllowIfViewerEqualsRule,
  AllowIfViewerRule,
  AlwaysDenyRule,
  PrivacyPolicy,
  Data,
  IDViewer,
  ID,
} from "@snowtop/ent";
import { AllowIfBuilder, Observer, Trigger } from "@snowtop/ent/action";
import CreateContactEmailAction from "../../../ent/contact_email/actions/create_contact_email_action";
import { ContactBuilder } from "../../generated/contact/actions/contact_builder";
import CreateContactPhoneNumberAction from "../../../ent/contact_phone_number/actions/create_contact_phone_number_action";
import { ExampleViewer } from "../../../viewer/viewer";

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

  triggers: Trigger<
    Contact,
    ContactBuilder,
    ExampleViewer,
    ContactCreateInput
  >[] = [
    {
      async changeset(builder, input) {
        if (!input.emails) {
          return;
        }
        const emailIds: ID[] = [];
        const changesets = await Promise.all(
          input.emails.map(async (email) => {
            const action = CreateContactEmailAction.create(builder.viewer, {
              emailAddress: email.emailAddress,
              label: email.label,
              contactID: builder,
            });
            // use getPossibleUnsafeEntForPrivacy for this
            const unsafe =
              await action.builder.orchestrator.getPossibleUnsafeEntForPrivacy();
            emailIds.push(unsafe!.id);
            return action.changeset();
          }),
        );

        builder.updateInput({
          emailIds,
        });
        return changesets;
      },
    },
    {
      async changeset(builder, input) {
        if (!input.phoneNumbers) {
          return;
        }
        const phoneNumberIds: ID[] = [];
        const changesets = await Promise.all(
          input.phoneNumbers.map(async (phone) => {
            const action = CreateContactPhoneNumberAction.create(
              builder.viewer,
              {
                phoneNumber: phone.phoneNumber,
                label: phone.label,
                contactID: builder,
              },
            );
            const edited = await action.builder.orchestrator.getEditedData();
            phoneNumberIds.push(edited.id);
            return action.changeset();
          }),
        );

        builder.updateInput({
          phoneNumberIds,
        });

        return changesets;
      },
    },
  ];

  observers: Observer<
    Contact,
    ContactBuilder,
    ExampleViewer,
    ContactCreateInput
  >[] = [new EntCreationObserver()];

  viewerForEntLoad(data: Data) {
    // needed if created in user action and we want to make sure this
    // ent is viewable. especially bcos of EntCreationObserver
    return new IDViewer(data.user_id);
  }
}
