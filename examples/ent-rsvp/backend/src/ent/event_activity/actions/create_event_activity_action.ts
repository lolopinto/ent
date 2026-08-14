import { Viewer, ID } from "@snowtop/ent";
import { CreateEventActivityActionBase } from "../../generated/event_activity/actions/create_event_activity_action_base.js";
import type {
  EventActivityCreateInput,
  CreateEventActivityActionTriggers,
} from "../../generated/event_activity/actions/create_event_activity_action_base.js";
import { AllowIfEventCreatorPrivacyPolicy } from "../../event/privacy/event_creator.js";
export type { EventActivityCreateInput };
import { Builder } from "@snowtop/ent/action";
import CreateAddressAction from "../../address/actions/create_address_action.js";
import { NodeType } from "../../generated/const.js";
import { Event, EventToGuestGroupsQuery } from "../../index.js";

// we're only writing this once except with --force and packageName provided
export default class CreateEventActivityAction extends CreateEventActivityActionBase {
  getPrivacyPolicy() {
    // only creator of event can create activity
    return new AllowIfEventCreatorPrivacyPolicy(this.input.eventId, this.input);
  }

  getTriggers(): CreateEventActivityActionTriggers {
    return [
      {
        changeset: async (builder) => {
          if (!this.input.address) {
            return;
          }
          return CreateAddressAction.create(builder.viewer, {
            ...this.input.address,
            ownerId: builder,
            ownerType: NodeType.EventActivity,
          }).changeset();
        },
      },
      {
        changeset: async (builder, input) => {
          if (!input.inviteAllGuests) {
            return;
          }
          const isBuilder = (
            v: ID | Builder<Event, Viewer>,
          ): v is Builder<Event, Viewer> => {
            return (v as Builder<Event, Viewer>).placeholderID !== undefined;
          };

          if (isBuilder(input.eventId)) {
            return;
          }
          // get all the existing ids and invite them
          const ids = await EventToGuestGroupsQuery.query(
            builder.viewer,
            input.eventId,
          )
            .first(10000)
            .queryIDs();

          builder.addInvite(...ids);
        },
      },
    ];
  }
}
