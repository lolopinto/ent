import {
  AlwaysAllowPrivacyPolicy,
  Data,
  IDViewer,
  PrivacyPolicy,
} from "@snowtop/ent";
import { Changeset } from "@snowtop/ent/action";
import { EntCreationObserver } from "@snowtop/ent/testutils/fake_log";
import { FakeComms, Mode } from "@snowtop/ent/testutils/fake_comms";
import {
  CreateUserActionBase,
  UserCreateInput,
} from "../../generated/user/actions/create_user_action_base";
import { UserBuilder } from "../../generated/user/actions/user_builder";
import CreateContactAction from "../../contact/actions/create_contact_action";
import { User } from "../../";

export { UserCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateUserAction extends CreateUserActionBase {
  getPrivacyPolicy(): PrivacyPolicy<User> {
    return AlwaysAllowPrivacyPolicy;
  }

  viewerForEntLoad(data: Data) {
    return new IDViewer(data.id);
  }

  triggers = [
    {
      // also create a contact for self when creating user
      changeset: (
        builder: UserBuilder,
        input: UserCreateInput,
      ): Promise<Changeset> => {
        let action = CreateContactAction.create(this.builder.viewer, {
          firstName: input.firstName,
          lastName: input.lastName,
          emails: [
            {
              emailAddress: input.emailAddress,
              label: "self",
            },
          ],
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
