import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { TodoRemoveTagActionBase } from "src/ent/generated/todo/actions/todo_remove_tag_action_base";

export default class TodoRemoveTagAction extends TodoRemoveTagActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
