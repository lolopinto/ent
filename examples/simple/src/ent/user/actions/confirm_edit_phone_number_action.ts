import type { Trigger, Validator } from "@snowtop/ent/action";
import { ConfirmEditPhoneNumberActionBase } from "../../generated/user/actions/confirm_edit_phone_number_action_base.js";
import type { ConfirmEditPhoneNumberInput } from "../../generated/user/actions/confirm_edit_phone_number_action_base.js";
import { User } from "../../index.js";
import { UserBuilder } from "../../generated/user/actions/user_builder.js";
import DeleteAuthCodeAction from "../../auth_code/actions/delete_auth_code_action.js";
import { ExampleViewer } from "../../../viewer/viewer.js";
export type { ConfirmEditPhoneNumberInput };
async function findAuthCode(
  builder: UserBuilder,
  code: string,
  phoneNumber: string,
) {
  const user = await User.loadX(builder.viewer, builder.viewer.viewerID!);
  const authCodes = await user.queryAuthCodes().queryEnts();
  return authCodes.find(
    (authCode) => authCode.code == code && authCode.phoneNumber == phoneNumber,
  );
}
// we're only writing this once except with --force and packageName provided
export default class ConfirmEditPhoneNumberAction extends ConfirmEditPhoneNumberActionBase {
  getValidators(): Validator<
    User,
    UserBuilder<ConfirmEditPhoneNumberInput, User>,
    ExampleViewer,
    ConfirmEditPhoneNumberInput,
    User
  >[] {
    return [
      {
        async validate(builder, input) {
          const authCode = await findAuthCode(
            builder,
            input.code,
            input.phoneNumber,
          );
          if (!authCode) {
            throw new Error(
              `code ${input.code} not found associated with user`,
            );
          }
        },
      },
    ];
  }

  getTriggers(): Trigger<
    User,
    UserBuilder<ConfirmEditPhoneNumberInput, User>,
    ExampleViewer,
    ConfirmEditPhoneNumberInput,
    User
  >[] {
    return [
      {
        async changeset(builder, input) {
          const authCode = await findAuthCode(
            builder,
            input.code,
            input.phoneNumber,
          );
          if (!authCode) {
            throw new Error(
              `code ${input.code} not found associated with user`,
            );
          }
          // delete the authCode
          return DeleteAuthCodeAction.create(
            builder.viewer,
            authCode,
          ).changeset();
        },
      },
    ];
  }
}
