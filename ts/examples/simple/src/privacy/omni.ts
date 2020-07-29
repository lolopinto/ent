import { Allow, Skip, PrivacyResult } from "ent/core/privacy";
import { Ent, Viewer } from "ent/core/ent";

export const AllowIfOmniRule = {
  async apply(v: Viewer, ent: Ent): Promise<PrivacyResult> {
    if (v.isOmniscient && v.isOmniscient()) {
      return Allow();
    }
    return Skip();
  },
};
