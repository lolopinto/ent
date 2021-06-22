import { Ent } from "@snowtop/snowtop-ts";
import { Trigger, Validator } from "@snowtop/snowtop-ts/action";
import DeleteAuthCodeAction from "src/ent/auth_code/actions/delete_auth_code_action";
import { User } from "src/ent/user";
import {
  ConfirmEditEmailAddressActionBase,
  ConfirmEditEmailAddressInput,
} from "src/ent/user/actions/generated/confirm_edit_email_address_action_base";
import { UserBuilder } from "./user_builder";

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
