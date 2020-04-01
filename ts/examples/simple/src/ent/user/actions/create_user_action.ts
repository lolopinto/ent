import {
  CreateUserActionBase,
  UserCreateInput,
} from "src/ent/user/actions/generated/create_user_action_base";

export { UserCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateUserAction extends CreateUserActionBase {}
