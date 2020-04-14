import {
  CreateUserActionBase,
  UserCreateInput,
} from "src/ent/user/actions/generated/create_user_action_base";
import { UserBuilder } from "./user_builder";

export { UserCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateUserAction extends CreateUserActionBase {
  triggers = [
    {
      changeset: async (builder: UserBuilder): Promise<void> => {
        builder.updateInput({
          accountStatus: "UNVERIFIED",
          // not needed because we have serverDefault but can also set it here.
          emailVerified: false,
        });
      },
    },
  ];
}
