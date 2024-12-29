import { Viewer, ID } from "@snowtop/ent";
import {
  CreateEventActivityActionBase,
  EventActivityCreateInput,
  CreateEventActivityActionTriggers,
} from "src/ent/generated/event_activity/actions/create_event_activity_action_base";
import { AllowIfEventCreatorPrivacyPolicy } from "src/ent/event/privacy/event_creator";
export { EventActivityCreateInput };
import { Builder } from "@snowtop/ent/action";
import CreateAddressAction from "src/ent/address/actions/create_address_action";
import { NodeType } from "src/ent/generated/const";
import { Event, EventToGuestGroupsQuery } from "src/ent";

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
