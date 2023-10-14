import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { TodoAddTagActionBase } from "src/ent/generated/todo/actions/todo_add_tag_action_base";

export class TodoAddTagAction extends TodoAddTagActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
