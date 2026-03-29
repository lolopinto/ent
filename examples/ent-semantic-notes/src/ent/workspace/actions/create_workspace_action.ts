import type { WorkspaceCreateInput } from "../../generated/workspace/actions/create_workspace_action_base";
import { CreateWorkspaceActionBase } from "../../generated/workspace/actions/create_workspace_action_base";

export type { WorkspaceCreateInput };

export default class CreateWorkspaceAction extends CreateWorkspaceActionBase {}
