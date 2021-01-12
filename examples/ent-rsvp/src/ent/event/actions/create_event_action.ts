import {
  AllowIfViewerEqualsRule,
  AlwaysDenyRule,
  Ent,
  PrivacyPolicy,
} from "@lolopinto/ent";
import { Trigger } from "@lolopinto/ent/action";
import {
  CreateEventActionBase,
  EventCreateInput,
} from "src/ent/event/actions/generated/create_event_action_base";

export { EventCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateEventAction extends CreateEventActionBase {
  getPrivacyPolicy(): PrivacyPolicy {
    return {
      rules: [
        new AllowIfViewerEqualsRule(this.input.creatorID),
        AlwaysDenyRule,
      ],
    };
  }
}
