import {
  CreateUserActionBase,
  UserCreateInput,
} from "src/ent/user/actions/generated/create_user_action_base";
import { UserBuilder } from "./user_builder";
import CreateContactAction from "src/ent/contact/actions/create_contact_action";
import Contact from "src/ent/contact";
import User, { AccountStatus } from "src/ent/user";

import { Changeset } from "ent/action";
import { EntCreationObserver } from "ent/testutils/fake_log";
import { FakeComms, Mode } from "ent/testutils/fake_comms";

export { UserCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateUserAction extends CreateUserActionBase {
  triggers = [
    {
      changeset: (builder: UserBuilder): void => {
        builder.updateInput({
          accountStatus: AccountStatus.UNVERIFIED,
          // not needed because we have serverDefault but can also set it here.
          emailVerified: false,
        });
      },
    },
    {
      // also create a contact for self when creating user
      changeset: (builder: UserBuilder): Promise<Changeset<Contact>> => {
        let input = builder.getInput();
        let action = CreateContactAction.create(this.builder.viewer, {
          firstName: input.firstName!,
          lastName: input.lastName!,
          emailAddress: input.emailAddress!,
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
      observe: (builder: UserBuilder): void => {
        let input = builder.getInput();
        let email = input.emailAddress!;
        let firstName = input.firstName!;
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
