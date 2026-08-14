import { CreateGuestGroupActionBase } from "../../generated/guest_group/actions/create_guest_group_action_base.js";
import type {
  GuestGroupCreateInput,
  CreateGuestGroupActionTriggers,
} from "../../generated/guest_group/actions/create_guest_group_action_base.js";
import { AllowIfEventCreatorPrivacyPolicy } from "../../event/privacy/event_creator.js";
import { Event, EventToEventActivitiesQuery } from "../../index.js";
import EventActivityAddInviteAction from "../../event_activity/actions/event_activity_add_invite_action.js";
import { Builder } from "@snowtop/ent/action";
import { ID, Viewer } from "@snowtop/ent";
import CreateGuestAction from "../../guest/actions/create_guest_action.js";

export type { GuestGroupCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateGuestGroupAction extends CreateGuestGroupActionBase {
  getPrivacyPolicy() {
    // only creator of event can create guest group
    return new AllowIfEventCreatorPrivacyPolicy(this.input.eventId);
  }

  getTriggers(): CreateGuestGroupActionTriggers {
    return [
      {
        async changeset(builder, input) {
          const isBuilder = (
            v: ID | Builder<Event, Viewer>,
          ): v is Builder<Event, Viewer> => {
            return (v as Builder<Event, Viewer>).placeholderID !== undefined;
          };
          if (isBuilder(input.eventId)) {
            return;
          }

          // filter out and get only activities that invite all guests
          // TODO EntQuery should support this natively
          let activities = await EventToEventActivitiesQuery.query(
            builder.viewer,
            input.eventId,
          ).queryEnts();
          activities = activities.filter(
            (activity) => activity.inviteAllGuests,
          );

          return Promise.all(
            activities.map((activity) =>
              EventActivityAddInviteAction.create(builder.viewer, activity, {})
                .addInviteID(builder)
                .changeset(),
            ),
          );
        },
      },
      {
        async changeset(builder, input) {
          if (!input.guests) {
            return;
          }

          return Promise.all(
            input.guests.map(async (guest) => {
              return CreateGuestAction.create(builder.viewer, {
                eventId: input.eventId,
                guestGroupId: builder,
                ...guest,
              }).changeset();
            }),
          );
        },
      },
    ];
  }
}
