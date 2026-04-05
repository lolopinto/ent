import {
  PrivacyPolicy,
  Viewer,
  Ent,
  ID,
  AllowIfViewerIsEntPropertyRule,
  AlwaysDenyRule,
} from "@snowtop/ent";
import { EditWorkspaceActionBase } from "src/ent/generated/workspace/actions/edit_workspace_action_base";
import type { WorkspaceEditInput } from "src/ent/generated/workspace/actions/edit_workspace_action_base";
import { Workspace } from "src/ent/workspace";

export type { WorkspaceEditInput };

export class EditWorkspaceAction extends EditWorkspaceActionBase {
  getPrivacyPolicy(): PrivacyPolicy<
    Workspace,
    Viewer<Ent<any> | null, ID | null>
  > {
    return {
      rules: [new AllowIfViewerIsEntPropertyRule("creatorId"), AlwaysDenyRule],
    };
  }
}
