import {
  CreateGuestActionBase,
  GuestCreateInput,
  CreateGuestActionTriggers,
} from "src/ent/generated/guest/actions/create_guest_action_base";
import { AllowIfEventCreatorPrivacyPolicy } from "src/ent/event/privacy/event_creator";
import { Trigger } from "@snowtop/ent/action";
import { Ent, Viewer } from "@snowtop/ent";
import { GuestBuilder } from "../../generated/guest/actions/guest_builder";
import CreateAuthCodeAction from "src/ent/auth_code/actions/create_auth_code_action";

export { GuestCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateGuestAction extends CreateGuestActionBase {
  getPrivacyPolicy() {
    // only creator of event can create guest
    return new AllowIfEventCreatorPrivacyPolicy(this.input.eventID);
  }

  getTriggers(): CreateGuestActionTriggers {
    return [
      {
        async changeset(builder, input) {
          if (!input.emailAddress) {
            return;
          }
          return CreateAuthCodeAction.create(builder.viewer, {
            code: createNewCode(),
            guestID: builder,
            emailAddress: input.emailAddress,
          }).changeset();
        },
      },
    ];
  }
}

function createNewCode() {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += Math.floor(Math.random() * 10);
  }
  return code;
}
