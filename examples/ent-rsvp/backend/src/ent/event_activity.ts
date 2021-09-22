import {
  AllowIfEdgeExistsRule,
  AllowIfEntIsVisiblePolicy,
  AlwaysAllowRule,
  AlwaysDenyRule,
  DelayedResultRule,
  DenyIfEntIsNotVisibleRule,
  PrivacyPolicy,
} from "@snowtop/ent";
import { gqlField } from "@snowtop/ent/graphql";
import {
  Event,
  EventActivityBase,
  EventActivityRsvpStatus,
} from "src/ent/internal";
import { Address, Guest } from ".";
import { EdgeType } from "./generated/const";
import { AllowIfEventCreatorRule } from "./event/privacy/event_creator";

// we're only writing this once except with --force and packageName provided
export class EventActivity extends EventActivityBase {
  privacyPolicy: PrivacyPolicy = {
    rules: [
      // if can't see event, can see activity
      new DenyIfEntIsNotVisibleRule(this.eventID, Event.loaderOptions()),
      // creator can see
      new AllowIfEventCreatorRule(this.eventID),
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
          g.guestGroupID,
          EdgeType.EventActivityToInvites,
        );
      }),
      AlwaysDenyRule,
    ],
  };

  protected async rsvpStatus() {
    if (!this.viewer.viewerID) {
      return EventActivityRsvpStatus.CannotRsvp;
    }
    return EventActivityRsvpStatus.CanRsvp;
  }

  @gqlField({ name: "address", type: "Address", nullable: true })
  async address(): Promise<Address | null> {
    return Address.loadFromOwnerID(this.viewer, this.id);
  }
}
