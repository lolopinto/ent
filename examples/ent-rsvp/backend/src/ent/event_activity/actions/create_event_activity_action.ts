import { Viewer, ID } from "@snowtop/ent";
import {
  CreateEventActivityActionBase,
  EventActivityCreateInput,
  CreateEventActivityActionTriggers,
} from "src/ent/generated/event_activity/actions/create_event_activity_action_base";
import { AllowIfEventCreatorPrivacyPolicy } from "src/ent/event/privacy/event_creator";
export { EventActivityCreateInput };
import { Builder, Trigger } from "@snowtop/ent/action";
import CreateAddressAction from "src/ent/address/actions/create_address_action";
import { NodeType } from "src/ent/generated/const";
import { EventActivityBuilder } from "../../generated/event_activity/actions/event_activity_builder";
import { Event, EventToGuestGroupsQuery } from "src/ent";

// we're only writing this once except with --force and packageName provided
export default class CreateEventActivityAction extends CreateEventActivityActionBase {
  getPrivacyPolicy() {
    // only creator of event can create activity
    return new AllowIfEventCreatorPrivacyPolicy(this.input.eventID, this.input);
  }

  getTriggers(): CreateEventActivityActionTriggers {
    return [
      {
        changeset: async (builder) => {
          if (!this.input.address) {
            return;
          }
          return await CreateAddressAction.create(builder.viewer, {
            ...this.input.address,
            ownerID: builder,
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

          if (isBuilder(input.eventID)) {
            return;
          }
          // get all the existing ids and invite them
          const ids = await EventToGuestGroupsQuery.query(
            builder.viewer,
            input.eventID,
          )
            .first(10000)
            .queryIDs();

          builder.addInvite(...ids);
        },
      },
    ];
  }
}
