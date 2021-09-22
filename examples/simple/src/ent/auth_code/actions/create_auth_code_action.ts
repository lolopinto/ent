import {
  CreateAuthCodeActionBase,
  AuthCodeCreateInput,
} from "./generated/create_auth_code_action_base";
import { AuthCodeBuilder } from "./generated/auth_code_builder";

export { AuthCodeCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateAuthCodeAction extends CreateAuthCodeActionBase {
  validators = [
    {
      validate(builder: AuthCodeBuilder, input: AuthCodeCreateInput) {
        if (
          !(
            (input.emailAddress || input.phoneNumber) &&
            !(input.emailAddress && input.phoneNumber)
          )
        ) {
          throw new Error(
            `exactly one of phoneNumber and emailAddress needs to be provided`,
          );
        }
      },
    },
  ];
}
