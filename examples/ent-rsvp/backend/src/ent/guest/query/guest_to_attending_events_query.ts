import { GuestToAttendingEventsQueryBase } from "src/ent/internal";
import { AssocEdge, Context } from "@snowtop/ent";
import { gqlContextType, gqlField } from "@snowtop/ent/graphql";
import { GuestData } from "src/ent";

export class GuestToAttendingEventsEdge extends AssocEdge {
  @gqlField({ type: "String", nullable: true })
  async dietaryRestrictions(@gqlContextType() context: Context) {
    if (this.data) {
      const guestData = await GuestData.load(context.getViewer(), this.data);
      return guestData?.dietaryRestrictions;
    }
    return null;
  }
}

export class GuestToAttendingEventsQuery extends GuestToAttendingEventsQueryBase {}
