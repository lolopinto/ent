import {
  CreateGuestGroupActionBase,
  GuestGroupCreateInput,
} from "src/ent/guest_group/actions/generated/create_guest_group_action_base";
import { AllowIfEventCreatorPrivacyPolicy } from "src/ent/event/privacy/event_creator";
import { EventToEventActivitiesQuery } from "src/ent";
import EventActivityAddInviteAction from "src/ent/event_activity/actions/event_activity_add_invite_action";
import { Trigger } from "@snowtop/ent/action";
import { Ent } from "@snowtop/ent";
import { GuestGroupBuilder } from "./generated/guest_group_builder";
import CreateGuestAction from "src/ent/guest/actions/create_guest_action";

export { GuestGroupCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateGuestGroupAction extends CreateGuestGroupActionBase {
  getPrivacyPolicy() {
    // only creator of event can create guest group
    return new AllowIfEventCreatorPrivacyPolicy(this.input.eventID);
  }

  triggers: Trigger<Ent>[] = [
    {
      async changeset(
        builder: GuestGroupBuilder,
        input: GuestGroupCreateInput,
      ) {
        if (builder.isBuilder(input.eventID)) {
          return;
        }

        // filter out and get only activities that invite all guests
        // TODO EntQuery should support this natively
        let activities = await EventToEventActivitiesQuery.query(
          builder.viewer,
          input.eventID,
        ).queryEnts();
        activities = activities.filter((activity) => activity.inviteAllGuests);

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
      async changeset(
        builder: GuestGroupBuilder,
        input: GuestGroupCreateInput,
      ) {
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
