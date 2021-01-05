import {
  CreateUserActionBase,
  UserCreateInput,
} from "src/ent/user/actions/generated/create_user_action_base";
import { UserBuilder } from "./user_builder";
import CreateContactAction from "src/ent/contact/actions/create_contact_action";
import { Contact, User } from "src/ent/";

import { Changeset } from "@lolopinto/ent/action";
import { EntCreationObserver } from "@lolopinto/ent/testutils/fake_log";
import { FakeComms, Mode } from "@lolopinto/ent/testutils/fake_comms";
import { AlwaysAllowPrivacyPolicy } from "@lolopinto/ent";

export { UserCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateUserAction extends CreateUserActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }

  triggers = [
    {
      changeset: (builder: UserBuilder, _input: UserCreateInput): void => {
        builder.updateInput({
          accountStatus: "UNVERIFIED",
          // not needed because we have serverDefault but can also set it here.
          emailVerified: false,
        });
      },
    },
    {
      // also create a contact for self when creating user
      changeset: (
        builder: UserBuilder,
        input: UserCreateInput,
      ): Promise<Changeset<Contact>> => {
        let action = CreateContactAction.create(this.builder.viewer, {
          firstName: input.firstName,
          lastName: input.lastName,
          emailAddress: input.emailAddress,
          userID: builder,
        });

        builder.addSelfContact(action.builder);
        return action.changeset();
      },
    },
  ];

  observers = [
    {
      // TODO this seems better as Action<T>
      // and will be better for typing to get the fields from the action since we
      // can get required fields
      // can get builder from action also
      // AND works when we have action-only fields since they'll be defined on the action but not the builder
      observe: (_builder: UserBuilder, input: UserCreateInput): void => {
        let email = input.emailAddress;
        let firstName = input.firstName;
        FakeComms.send({
          from: "noreply@foo.com",
          to: email,
          subject: `Welcome, ${firstName}!`,
          body: `Hi ${firstName}, thanks for joining fun app!`,
          mode: Mode.EMAIL,
        });
      },
    },
    new EntCreationObserver<User>(),
  ];
}
