import { Allow, Skip, PrivacyResult } from "ent/privacy";
import { Ent, Viewer } from "ent/ent";

export const AllowIfOmniRule = {
  async apply(v: Viewer, ent: Ent): Promise<PrivacyResult> {
    if (v.isOmniscient && v.isOmniscient()) {
      return Allow();
    }
    return Skip();
  },
};
