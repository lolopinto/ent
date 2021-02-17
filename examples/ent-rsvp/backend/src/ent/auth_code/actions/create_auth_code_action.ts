import {
  CreateAuthCodeActionBase,
  AuthCodeCreateInput,
} from "src/ent/auth_code/actions/generated/create_auth_code_action_base";

export { AuthCodeCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateAuthCodeAction extends CreateAuthCodeActionBase {}
