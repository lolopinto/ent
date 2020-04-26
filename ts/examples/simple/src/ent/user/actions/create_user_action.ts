import {
  CreateUserActionBase,
  UserCreateInput,
} from "src/ent/user/actions/generated/create_user_action_base";
import { UserBuilder } from "./user_builder";
import CreateContactAction from "src/ent/contact/actions/create_contact_action";
import Contact from "src/ent/contact";
import { Changeset } from "ent/action";

export { UserCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateUserAction extends CreateUserActionBase {
  triggers = [
    {
      changeset: (builder: UserBuilder): void => {
        builder.updateInput({
          accountStatus: "UNVERIFIED",
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
}
