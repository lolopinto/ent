import { Ent } from "@snowtop/ent";
import { Trigger, Validator } from "@snowtop/ent/action";
import DeleteAuthCodeAction from "../../auth_code/actions/delete_auth_code_action";
import { User } from "../../";
import {
  ConfirmEditEmailAddressActionBase,
  ConfirmEditEmailAddressInput,
} from "./generated/confirm_edit_email_address_action_base";
import { UserBuilder } from "./generated/user_builder";

export { ConfirmEditEmailAddressInput };

async function findAuthCode(
  builder: UserBuilder,
  code: string,
  emailAddress: string,
) {
  const user = await User.loadX(builder.viewer, builder.viewer.viewerID!);
  const authCodes = await user.queryAuthCodes().queryEnts();
  return authCodes.find(
    (authCode) =>
      authCode.code == code && authCode.emailAddress == emailAddress,
  );
}

export default class ConfirmEditEmailAddressAction extends ConfirmEditEmailAddressActionBase {
  validators: Validator<User>[] = [
    {
      async validate(
        builder: UserBuilder,
        input: ConfirmEditEmailAddressInput,
      ) {
        const authCode = await findAuthCode(
          builder,
          input.code,
          input.emailAddress,
        );
        if (!authCode) {
          throw new Error(`code ${input.code} not found associated with user`);
        }
      },
    },
  ];

  triggers: Trigger<Ent>[] = [
    {
      async changeset(
        builder: UserBuilder,
        input: ConfirmEditEmailAddressInput,
      ) {
        const authCode = await findAuthCode(
          builder,
          input.code,
          input.emailAddress,
        );
        if (!authCode) {
          throw new Error(`code ${input.code} not found associated with user`);
        }
        // delete the authCode
        return await DeleteAuthCodeAction.create(
          builder.viewer,
          authCode,
        ).changeset();
      },
    },
  ];
}
