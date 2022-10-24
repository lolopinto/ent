import {
  AllowIfViewerInboundEdgeExistsRule,
  AllowIfViewerIsEntPropertyRule,
  AlwaysDenyRule,
  PrivacyPolicy,
  Viewer,
} from "@snowtop/ent";
import { EdgeType, WorkspaceBase } from "src/ent/internal";

export class Workspace extends WorkspaceBase {
  getPrivacyPolicy(): PrivacyPolicy<this, Viewer> {
    return {
      rules: [
        new AllowIfViewerIsEntPropertyRule("creatorID"),
        new AllowIfViewerInboundEdgeExistsRule(EdgeType.AccountToWorkspaces),
        AlwaysDenyRule,
      ],
    };
  }
}
