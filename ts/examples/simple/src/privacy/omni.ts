import { Allow, Skip, PrivacyResult, Ent, Viewer } from "@lolopinto/ent";

export const AllowIfOmniRule = {
  async apply(v: Viewer, ent: Ent): Promise<PrivacyResult> {
    if (v.isOmniscient && v.isOmniscient()) {
      return Allow();
    }
    return Skip();
  },
};
