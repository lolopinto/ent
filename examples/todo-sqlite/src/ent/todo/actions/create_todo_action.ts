import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import {
  CreateTodoActionBase,
  CreateTodoActionTriggers,
  TodoCreateInput,
} from "src/ent/generated/todo/actions/create_todo_action_base";
import { NodeType } from "src/ent/internal";

export { TodoCreateInput };

export default class CreateTodoAction extends CreateTodoActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }

  getTriggers(): CreateTodoActionTriggers {
    return [
      {
        changeset(builder, input) {
          const scopeID = builder.getNewScopeIDValue();
          builder.addTodoScopeID(
            scopeID,
            builder.getNewScopeTypeValue() as NodeType,
          );
        },
      },
    ];
  }
}
