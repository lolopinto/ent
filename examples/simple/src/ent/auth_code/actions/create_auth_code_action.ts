import {
  CreateAuthCodeActionBase,
  AuthCodeCreateInput,
} from "../../generated/auth_code/actions/create_auth_code_action_base";
import { AuthCodeBuilder } from "../../generated/auth_code/actions/auth_code_builder";

export { AuthCodeCreateInput };
import { ExampleViewer } from "../../../viewer/viewer";
import { AuthCode } from "../../";
import { Validator } from "@snowtop/ent/action";

// we're only writing this once except with --force and packageName provided
export default class CreateAuthCodeAction extends CreateAuthCodeActionBase {
  getValidators(): Validator<
    AuthCode,
    AuthCodeBuilder<AuthCodeCreateInput, AuthCode | null>,
    ExampleViewer,
    AuthCodeCreateInput,
    AuthCode | null
  >[] {
    return [
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
}
