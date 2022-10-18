import {
  PrivacyPolicy,
  Viewer,
  Ent,
  ID,
  AllowIfViewerIsEntPropertyRule,
  AlwaysDenyRule,
} from "@snowtop/ent";
import { DeleteWorkspaceActionBase } from "src/ent/generated/workspace/actions/delete_workspace_action_base";
import { Workspace } from "src/ent/workspace";

export default class DeleteWorkspaceAction extends DeleteWorkspaceActionBase {
  getPrivacyPolicy(): PrivacyPolicy<
    Workspace,
    Viewer<Ent<any> | null, ID | null>
  > {
    return {
      rules: [new AllowIfViewerIsEntPropertyRule("creatorID"), AlwaysDenyRule],
    };
  }
}
