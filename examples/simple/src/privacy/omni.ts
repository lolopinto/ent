import { Allow, Skip, PrivacyResult, Ent, Viewer } from "@snowtop/ent";

interface OmniViewer extends Viewer {
  isOmniscient(): boolean;
}

export const AllowIfOmniRule = {
  async apply(v: Viewer, ent: Ent): Promise<PrivacyResult> {
    if (
      (v as OmniViewer).isOmniscient !== undefined &&
      (v as OmniViewer).isOmniscient()
    ) {
      return Allow();
    }
    return Skip();
  },
};
