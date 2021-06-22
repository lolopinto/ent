import {
  CreateUserActionBase,
  UserCreateInput,
} from "src/ent/user/actions/generated/create_user_action_base";
import { UserBuilder } from "./user_builder";
import CreateContactAction from "src/ent/contact/actions/create_contact_action";
import { Contact, User } from "src/ent/";

import { Changeset } from "@snowtop/snowtop-ts/action";
import { EntCreationObserver } from "@snowtop/snowtop-ts/testutils/fake_log";
import { FakeComms, Mode } from "@snowtop/snowtop-ts/testutils/fake_comms";
import { AlwaysAllowPrivacyPolicy, Data, IDViewer } from "@snowtop/snowtop-ts";

export { UserCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateUserAction extends CreateUserActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }

  viewerForEntLoad(data: Data) {
    return new IDViewer(data.id);
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
