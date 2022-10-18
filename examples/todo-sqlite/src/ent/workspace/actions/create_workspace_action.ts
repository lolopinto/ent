import {
  PrivacyPolicy,
  Viewer,
  Ent,
  ID,
  AllowIfViewerHasIdentityPrivacyPolicy,
} from "@snowtop/ent";
import {
  CreateWorkspaceActionBase,
  WorkspaceCreateInput,
} from "src/ent/generated/workspace/actions/create_workspace_action_base";
import { Workspace } from "src/ent/workspace";

export { WorkspaceCreateInput };

export default class CreateWorkspaceAction extends CreateWorkspaceActionBase {
  getPrivacyPolicy(): PrivacyPolicy<
    Workspace,
    Viewer<Ent<any> | null, ID | null>
  > {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }
}
