import { EventActivityToAttendingQueryBase } from "src/ent/internal";
import { AssocEdge, Context } from "@lolopinto/ent";
import { gqlContextType, gqlField } from "@lolopinto/ent/graphql";
import { GuestData } from "src/ent";

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

export class EventActivityToAttendingQuery extends EventActivityToAttendingQueryBase {}
