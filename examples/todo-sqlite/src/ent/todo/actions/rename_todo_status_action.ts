import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { RenameTodoStatusActionBase } from "src/ent/generated/todo/actions/rename_todo_status_action_base";
import type { RenameTodoInput } from "src/ent/generated/todo/actions/rename_todo_status_action_base";

export type { RenameTodoInput };

export class RenameTodoStatusAction extends RenameTodoStatusActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
