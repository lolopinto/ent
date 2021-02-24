import {
  AllowIfViewerEqualsRule,
  AlwaysDenyRule,
  PrivacyPolicy,
} from "@lolopinto/ent";
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
