import { FakeComms, Mode } from "@snowtop/ent/testutils/fake_comms";
import CreateAuthCodeAction from "../../auth_code/actions/create_auth_code_action";
import {
  EditPhoneNumberActionBase,
  EditPhoneNumberInput,
} from "./generated/edit_phone_number_action_base";
import { UserBuilder } from "./generated/user_builder";
import { User } from "../..";
import { EditUserPrivacy } from "./edit_user_privacy";

export { EditPhoneNumberInput };

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
    return CreateAuthCodeAction.create(builder.viewer, {
      phoneNumber: input.newPhoneNumber,
      userID: builder.viewer.viewerID!,
      code: this.getCode(),
    }).changeset();
  }

  observe(_builder: UserBuilder, input: EditPhoneNumberInput) {
    let body = `your new code is ${this.getCode()}`;

    FakeComms.send({
      to: input.newPhoneNumber,
      mode: Mode.SMS,
      from: "42423",
      body,
    });
  }
}

// we're only writing this once except with --force and packageName provided
export default class EditPhoneNumberAction extends EditPhoneNumberActionBase {
  private generateNewCode = new NewAuthCode();

  validators = [
    {
      // confirm email not being used
      async validate(builder: UserBuilder, input: EditPhoneNumberInput) {
        const id = await User.loadIDFromPhoneNumber(input.newPhoneNumber);
        if (id) {
          throw new Error(
            `cannot change phoneNumber to ${input.newPhoneNumber}`,
          );
        }
      },
    },
  ];
  triggers = [this.generateNewCode];

  observers = [this.generateNewCode];

  getPrivacyPolicy() {
    return EditUserPrivacy;
  }
}
