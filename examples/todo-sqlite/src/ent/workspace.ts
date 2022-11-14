import {
  AllowIfViewerInboundEdgeExistsRule,
  AllowIfViewerIsEntPropertyRule,
  AlwaysDenyRule,
  PrivacyPolicy,
  Viewer,
} from "@snowtop/ent";
import { WorkspaceBase } from "src/ent/internal";
import { EdgeType } from "src/ent/generated/types";

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
