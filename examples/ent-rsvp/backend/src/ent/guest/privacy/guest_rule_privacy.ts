import { Guest } from "src/ent/";
import { ID, PrivacyPolicyRule, Viewer, Ent, Skip, Allow } from "@snowtop/ent";

export class AllowIfGuestInSameGuestGroupRule implements PrivacyPolicyRule {
  constructor(private id?: ID) {}
  async apply(viewer: Viewer, ent: Ent) {
    if (!viewer.viewerID) {
      return Skip();
    }
    // short circuit if viewer
    if (viewer.viewerID === ent.id || viewer.viewerID === this.id) {
      return Allow();
    }
    // if id is passed, we're using that id instead of the ent we're using
    if (this.id) {
      ent = await Guest.loadX(viewer, this.id);
    }
    if (!viewer.context) {
      //      console.log(viewer.context);
    }
    //    console.log("cahce", viewer.context?.cache);
    const data = await Guest.loadRawData(viewer.viewerID, viewer.context);
    if (data && data.guest_group_id == (ent as Guest).guestGroupID) {
      return Allow();
    }
    return Skip();
  }
}
