import { EventActivityToAttendingQueryBase } from "src/ent/internal";
import {
  AssocEdge,
  Context,
  EdgeQuerySource,
  Viewer,
} from "@snowtop/snowtop-ts";
import { gqlContextType, gqlField } from "@snowtop/snowtop-ts/graphql";
import { EventActivity, GuestData } from "src/ent";

export class EventActivityToAttendingEdge extends AssocEdge {
  @gqlField({ type: "String", nullable: true })
  async dietaryRestrictions(@gqlContextType() context: Context) {
    if (this.data) {
      const guestData = await GuestData.load(context.getViewer(), this.data);
      return guestData?.dietaryRestrictions;
    }
    return null;
  }
}

export class EventActivityToAttendingQuery extends EventActivityToAttendingQueryBase {
  // constructor(viewer: Viewer, src: EdgeQuerySource<EventActivity>) {
  //   super(viewer, src);
  // }
}
