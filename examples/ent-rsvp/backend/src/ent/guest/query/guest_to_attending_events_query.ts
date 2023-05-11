import { GuestToAttendingEventsQueryBase } from "src/ent/internal";
import { AssocEdge, Context } from "@snowtop/ent";
import { gqlContextType, gqlField } from "@snowtop/ent/graphql";
import { GuestData } from "src/ent";

export class GuestToAttendingEventsEdge extends AssocEdge {
  @gqlField({
    class: "GuestToAttendingEventsEdge",
    type: "String",
    nullable: true,
    async: true,
    args: [gqlContextType()],
  })
  async dietaryRestrictions(context: Context) {
    if (this.data) {
      const guestData = await GuestData.load(context.getViewer(), this.data);
      return guestData?.dietaryRestrictions;
    }
    return null;
  }
}

export class GuestToAttendingEventsQuery extends GuestToAttendingEventsQueryBase {}
