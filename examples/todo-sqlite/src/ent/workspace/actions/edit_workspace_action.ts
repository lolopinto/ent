import {
  PrivacyPolicy,
  Viewer,
  Ent,
  ID,
  AllowIfViewerIsEntPropertyRule,
  AlwaysDenyRule,
} from "@snowtop/ent";
import {
  EditWorkspaceActionBase,
  WorkspaceEditInput,
} from "src/ent/generated/workspace/actions/edit_workspace_action_base";
import { Workspace } from "src/ent/workspace";

export { WorkspaceEditInput };

export default class EditWorkspaceAction extends EditWorkspaceActionBase {
  getPrivacyPolicy(): PrivacyPolicy<
    Workspace,
    Viewer<Ent<any> | null, ID | null>
  > {
    return {
      rules: [new AllowIfViewerIsEntPropertyRule("creatorID"), AlwaysDenyRule],
    };
  }
}
