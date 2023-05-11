import { EventActivityToAttendingQueryBase } from "src/ent/internal";
import { AssocEdge, Context, EdgeQuerySource, Viewer } from "@snowtop/ent";
import { gqlContextType, gqlField } from "@snowtop/ent/graphql";
import { GuestData } from "src/ent";

export class EventActivityToAttendingEdge extends AssocEdge {
  @gqlField({
    class: "EventActivityToAttendingEdge",
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

export class EventActivityToAttendingQuery extends EventActivityToAttendingQueryBase {
  // constructor(viewer: Viewer, src: EdgeQuerySource<EventActivity>) {
  //   super(viewer, src);
  // }
}
