import { type Data, IDViewer } from "@snowtop/ent";
import type { WorkspaceCreateInput } from "../../generated/workspace/actions/create_workspace_action_base.js";
import { CreateWorkspaceActionBase } from "../../generated/workspace/actions/create_workspace_action_base.js";

export type { WorkspaceCreateInput };

export default class CreateWorkspaceAction extends CreateWorkspaceActionBase {
  viewerForEntLoad(data: Data) {
    return new IDViewer(data.id);
  }
}
