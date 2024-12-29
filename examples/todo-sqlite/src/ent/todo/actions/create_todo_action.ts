import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import {
  CreateTodoActionBase,
  CreateTodoActionTriggers,
  TodoCreateInput,
} from "src/ent/generated/todo/actions/create_todo_action_base";
import { NodeType } from "src/ent/generated/types";
import { CreateTagAction } from "src/ent/tag/actions/create_tag_action";

export { TodoCreateInput };

export class CreateTodoAction extends CreateTodoActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }

  getTriggers(): CreateTodoActionTriggers {
    return [
      {
        changeset(builder, input) {
          const scopeID = builder.getNewScopeIdValue();
          builder.addTodoScopeID(
            scopeID,
            builder.getNewScopeTypeValue() as NodeType,
          );
        },
      },
      {
        async changeset(builder, input) {
          if (input.tags) {
            return Promise.all(
              input.tags.map(async (tagInput) => {
                const action = CreateTagAction.create(builder.viewer, {
                  ...tagInput,
                  ownerId: input.creatorId,
                });
                const tagId = await action.builder.getEntID();
                builder.addTag(tagId);
                return action.changeset();
              }),
            );
          }
        },
      },
    ];
  }
}
