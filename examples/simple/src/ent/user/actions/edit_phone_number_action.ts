import CreateAuthCodeAction from "../../auth_code/actions/create_auth_code_action";
import { EditPhoneNumberActionBase } from "../../generated/user/actions/edit_phone_number_action_base";
import type { EditPhoneNumberInput } from "../../generated/user/actions/edit_phone_number_action_base";
import { UserBuilder } from "../../generated/user/actions/user_builder";
import { User } from "../..";
import { EditUserPrivacy } from "./edit_user_privacy";

import { ExampleViewer } from "../../../viewer/viewer";
import type { Validator, Trigger } from "@snowtop/ent/action";
export type { EditPhoneNumberInput };
class NewAuthCode {
  private code: string = "";

  getCode() {
    if (this.code === "") {
      let code = "";
      for (let i = 0; i < 6; i++) {
        code += Math.floor(Math.random() * 10);
      }
      this.code = code;
    }
    return this.code;
  }

  changeset(builder: UserBuilder, input: EditPhoneNumberInput) {
    const body = `your new code is ${this.getCode()}`;

    return CreateAuthCodeAction.create(builder.viewer, {
      phoneNumber: input.newPhoneNumber,
      userId: builder.viewer.viewerID!,
      code: this.getCode(),
      body,
      from: "42423",
    }).changeset();
  }
}

// we're only writing this once except with --force and packageName provided
export default class EditPhoneNumberAction extends EditPhoneNumberActionBase {
  private generateNewCode = new NewAuthCode();

  getValidators(): Validator<
    User,
    UserBuilder<EditPhoneNumberInput, User>,
    ExampleViewer,
    EditPhoneNumberInput,
    User
  >[] {
    return [
      {
        // confirm email not being used
        async validate(builder: UserBuilder, input: EditPhoneNumberInput) {
          const id = await User.loadIdFromPhoneNumber(input.newPhoneNumber);
          if (id) {
            throw new Error(
              `cannot change phoneNumber to ${input.newPhoneNumber}`,
            );
          }
        },
      },
    ];
  }
  getTriggers(): Trigger<
    User,
    UserBuilder<EditPhoneNumberInput, User>,
    ExampleViewer,
    EditPhoneNumberInput,
    User
  >[] {
    return [this.generateNewCode];
  }

  getPrivacyPolicy() {
    return EditUserPrivacy;
  }
}
