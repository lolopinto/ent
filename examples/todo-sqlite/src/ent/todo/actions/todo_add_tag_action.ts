import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { TodoAddTagActionBase } from "src/ent/todo/actions/generated/todo_add_tag_action_base";

export default class TodoAddTagAction extends TodoAddTagActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
