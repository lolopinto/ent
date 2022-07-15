import {
  CreateGuestGroupActionBase,
  GuestGroupCreateInput,
  CreateGuestGroupActionTriggers,
} from "src/ent/generated/guest_group/actions/create_guest_group_action_base";
import { AllowIfEventCreatorPrivacyPolicy } from "src/ent/event/privacy/event_creator";
import { Event, EventToEventActivitiesQuery } from "src/ent";
import EventActivityAddInviteAction from "src/ent/event_activity/actions/event_activity_add_invite_action";
import { Builder } from "@snowtop/ent/action";
import { ID, Viewer } from "@snowtop/ent";
import CreateGuestAction from "src/ent/guest/actions/create_guest_action";

export { GuestGroupCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateGuestGroupAction extends CreateGuestGroupActionBase {
  getPrivacyPolicy() {
    // only creator of event can create guest group
    return new AllowIfEventCreatorPrivacyPolicy(this.input.eventID);
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
          if (isBuilder(input.eventID)) {
            return;
          }

          // filter out and get only activities that invite all guests
          // TODO EntQuery should support this natively
          let activities = await EventToEventActivitiesQuery.query(
            builder.viewer,
            input.eventID,
          ).queryEnts();
          activities = activities.filter(
            (activity) => activity.inviteAllGuests,
          );

          return await Promise.all(
            activities.map((activity) =>
              EventActivityAddInviteAction.create(builder.viewer, activity)
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

          return await Promise.all(
            input.guests.map(async (guest) => {
              return CreateGuestAction.create(builder.viewer, {
                eventID: input.eventID,
                guestGroupID: builder,
                ...guest,
              }).changeset();
            }),
          );
        },
      },
    ];
  }
}
