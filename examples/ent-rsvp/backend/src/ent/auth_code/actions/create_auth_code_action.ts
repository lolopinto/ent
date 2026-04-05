import { CreateAuthCodeActionBase } from "src/ent/generated/auth_code/actions/create_auth_code_action_base";
import type { AuthCodeCreateInput } from "src/ent/generated/auth_code/actions/create_auth_code_action_base";

export type { AuthCodeCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateAuthCodeAction extends CreateAuthCodeActionBase {}
