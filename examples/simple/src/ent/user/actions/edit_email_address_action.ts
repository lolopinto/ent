import { EditEmailAddressActionBase } from "../../generated/user/actions/edit_email_address_action_base";
import type { EditEmailAddressInput } from "../../generated/user/actions/edit_email_address_action_base";
import { UserBuilder } from "../../generated/user/actions/user_builder";
import CreateAuthCodeAction from "../../auth_code/actions/create_auth_code_action";
import { User } from "../..";
import { EditUserPrivacy } from "./edit_user_privacy";

import { ExampleViewer } from "../../../viewer/viewer";
import type { Validator, Trigger } from "@snowtop/ent/action";
export type { EditEmailAddressInput };
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

  changeset(builder: UserBuilder, input: EditEmailAddressInput) {
    const link = `https://website/confirm?email=${
      input.newEmail
    }&code=${this.getCode()}`;

    return CreateAuthCodeAction.create(builder.viewer, {
      emailAddress: input.newEmail,
      userId: builder.viewer.viewerID!,
      code: this.getCode(),
      subject: "confirm email",
      from: "noreply@example-app.com",
      body: link,
    }).changeset();
  }
}

// we're only writing this once except with --force and packageName provided
export default class EditEmailAddressAction extends EditEmailAddressActionBase {
  private generateNewCode = new NewAuthCode();

  getValidators(): Validator<
    User,
    UserBuilder<EditEmailAddressInput, User>,
    ExampleViewer,
    EditEmailAddressInput,
    User
  >[] {
    return [
      {
        // confirm email not being used
        async validate(builder: UserBuilder, input: EditEmailAddressInput) {
          const id = await User.loadIdFromEmailAddress(input.newEmail);
          if (id) {
            throw new Error(`cannot change email to ${input.newEmail}`);
          }
        },
      },
    ];
  }
  getTriggers(): Trigger<
    User,
    UserBuilder<EditEmailAddressInput, User>,
    ExampleViewer,
    EditEmailAddressInput,
    User
  >[] {
    return [this.generateNewCode];
  }

  getPrivacyPolicy() {
    return EditUserPrivacy;
  }
}
