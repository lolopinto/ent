import { DeleteEventActionBase } from "src/ent/event/actions/generated/delete_event_action_base";
import {
  AllowIfViewerIsRule,
  AlwaysDenyRule,
  PrivacyPolicy,
} from "@snowtop/snowtop-ts";

// we're only writing this once except with --force and packageName provided
export default class DeleteEventAction extends DeleteEventActionBase {
  getPrivacyPolicy(): PrivacyPolicy {
    return {
      rules: [new AllowIfViewerIsRule("creatorID"), AlwaysDenyRule],
    };
  }
}
