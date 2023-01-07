import {
  PrivacyPolicy,
  Viewer,
  Ent,
  ID,
  AlwaysAllowPrivacyPolicy,
} from "@snowtop/ent";
import {
  ChangeTodoBountyActionBase,
  ChangeTodoBountyActionValidators,
  ChangeTodoBountyInput,
} from "src/ent/generated/todo/actions/change_todo_bounty_action_base";
import { NodeType } from "src/ent/generated/types";
import { Account } from "src/ent/internal";

export { ChangeTodoBountyInput };

export default class ChangeTodoBountyAction extends ChangeTodoBountyActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
  getValidators(): ChangeTodoBountyActionValidators {
    return [
      {
        async validate(builder, input) {
          if (!input.bounty) {
            return;
          }
          const creatorData = await Account.loadRawDataX(
            builder.existingEnt.creatorID,
            builder.viewer.context,
          );
          const bounty = input.bounty;

          if (bounty > creatorData.credits) {
            throw new Error(
              `cannot create bounty when account doesn't have enough credits for it`,
            );
          }

          const scope = await builder.existingEnt.loadScopeX();
          if (scope.nodeType !== NodeType.Workspace) {
            throw new Error(
              `bounties can only be created in a workspace scope`,
            );
          }

          if (
            builder.getNewAssigneeIDValue() === builder.getNewCreatorIDValue()
          ) {
            throw new Error(`cannot assign bounty when you're the assignee`);
          }
        },
      },
    ];
  }
}
