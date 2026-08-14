import { CreateAuthCodeActionBase } from "../../generated/auth_code/actions/create_auth_code_action_base.js";
import type { AuthCodeCreateInput } from "../../generated/auth_code/actions/create_auth_code_action_base.js";

export type { AuthCodeCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateAuthCodeAction extends CreateAuthCodeActionBase {}
