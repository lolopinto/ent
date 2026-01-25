import { CreateContactActionBase } from "../../generated/contact/actions/create_contact_action_base";
import type { ContactCreateInput } from "../../generated/contact/actions/create_contact_action_base";

import { Contact } from "../../";
// TODO...
import { EntCreationObserver } from "@snowtop/ent/testutils/fake_log";
import { AllowIfViewerEqualsRule, AllowIfViewerRule, AlwaysDenyRule } from "@snowtop/ent";
import type { PrivacyPolicy, Data, ID } from "@snowtop/ent";
import { AllowIfBuilder } from "@snowtop/ent/action";
import type { Observer, Trigger } from "@snowtop/ent/action";
import CreateContactEmailAction from "../../../ent/contact_email/actions/create_contact_email_action";
import { ContactBuilder } from "../../generated/contact/actions/contact_builder";
import CreateContactPhoneNumberAction from "../../../ent/contact_phone_number/actions/create_contact_phone_number_action";
import { ExampleViewer } from "../../../viewer/viewer";
export type { ContactCreateInput };
// we're only writing this once except with --force and packageName provided
export default class CreateContactAction extends CreateContactActionBase {
  getPrivacyPolicy(): PrivacyPolicy {
    return {
      rules: [
        AllowIfViewerRule,
        new AllowIfViewerEqualsRule(this.input.userId),
        new AllowIfBuilder(this.input.userId),
        AlwaysDenyRule,
      ],
    };
  }

  getTriggers(): Trigger<
    Contact,
    ContactBuilder<ContactCreateInput, Contact | null>,
    ExampleViewer,
    ContactCreateInput,
    Contact | null
  >[] {
    return [
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
                contactId: builder,
                ownerId: input.userId,
                extra: email.extra,
              });
              const newId = await action.builder.getEntID();
              emailIds.push(newId);
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
                  contactId: builder,
                  ownerId: input.userId,
                  extra: phone.extra,
                },
              );
              const newId = await action.builder.getEntID();
              phoneNumberIds.push(newId);
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
  }

  getObservers(): Observer<
    Contact,
    ContactBuilder<ContactCreateInput, Contact | null>,
    ExampleViewer,
    ContactCreateInput,
    Contact | null
  >[] {
    return [new EntCreationObserver()];
  }

  viewerForEntLoad(data: Data) {
    // needed if created in user action and we want to make sure this
    // ent is viewable. especially bcos of EntCreationObserver
    return new ExampleViewer(data.user_id);
  }
}
