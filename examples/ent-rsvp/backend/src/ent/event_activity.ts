import {
  AllowIfEdgeExistsRule,
  AlwaysDenyRule,
  DelayedResultRule,
  DenyIfEntIsNotVisibleRule,
  PrivacyPolicy,
} from "@snowtop/ent";
import { gqlField } from "@snowtop/ent/graphql";
import { Event, EventActivityBase } from "src/ent/internal";
import { Address, Guest } from ".";
import { EdgeType } from "./generated/const";
import { EventActivityRsvpStatus } from "./generated/types";
import { AllowIfEventCreatorRule } from "./event/privacy/event_creator";

// we're only writing this once except with --force and packageName provided
export class EventActivity extends EventActivityBase {
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return {
      rules: [
        // if can't see event, can see activity
        new DenyIfEntIsNotVisibleRule(this.eventId, Event.loaderOptions()),
        // creator can see
        new AllowIfEventCreatorRule(this.eventId),
        // can see if viewer guest group is invited to activity
        new DelayedResultRule(async (v, _ent) => {
          if (!this.viewer.viewerID) {
            return null;
          }
          // viewer can be User or Guest...
          const g = await Guest.load(v, this.viewer.viewerID);

          if (!g) {
            return null;
          }

          return new AllowIfEdgeExistsRule(
            this.id,
            g.guestGroupId,
            EdgeType.EventActivityToInvites,
          );
        }),
        AlwaysDenyRule,
      ],
    };
  }

  protected async rsvpStatus() {
    if (!this.viewer.viewerID) {
      return EventActivityRsvpStatus.CannotRsvp;
    }
    return EventActivityRsvpStatus.CanRsvp;
  }

  @gqlField({
    class: "EventActivity",
    name: "addressFromOwner",
    type: "Address",
    nullable: true,
    async: true,
  })
  async address(): Promise<Address | null> {
    return Address.loadFromOwnerId(this.viewer, this.id);
  }
}
