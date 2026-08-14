import { CreateGuestActionBase } from "../../generated/guest/actions/create_guest_action_base.js";
import type {
  GuestCreateInput,
  CreateGuestActionTriggers,
} from "../../generated/guest/actions/create_guest_action_base.js";
import { AllowIfEventCreatorPrivacyPolicy } from "../../event/privacy/event_creator.js";
import CreateAuthCodeAction from "../../auth_code/actions/create_auth_code_action.js";

export type { GuestCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateGuestAction extends CreateGuestActionBase {
  getPrivacyPolicy() {
    // only creator of event can create guest
    return new AllowIfEventCreatorPrivacyPolicy(this.input.eventId);
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
            guestId: builder,
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
