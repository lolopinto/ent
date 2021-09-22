import { Data, Ent, AlwaysDenyRule } from "@snowtop/ent";
import {
  CreateEventActivityActionBase,
  EventActivityCreateInput,
} from "src/ent/event_activity/actions/generated/create_event_activity_action_base";
import { AllowIfEventCreatorPrivacyPolicy } from "src/ent/event/privacy/event_creator";
export { EventActivityCreateInput };
import { Trigger } from "@snowtop/ent/action";
import CreateAddressAction from "src/ent/address/actions/create_address_action";
import { NodeType } from "src/ent/generated/const";
import { EventActivityBuilder } from "./generated/event_activity_builder";
import { EventToGuestGroupsQuery } from "src/ent";

// we're only writing this once except with --force and packageName provided
export default class CreateEventActivityAction extends CreateEventActivityActionBase {
  getPrivacyPolicy() {
    // only creator of event can create activity
    return new AllowIfEventCreatorPrivacyPolicy(this.input.eventID, this.input);
  }

  triggers: Trigger<Ent>[] = [
    {
      changeset: async (builder: EventActivityBuilder, _input: Data) => {
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
      changeset: async (
        builder: EventActivityBuilder,
        input: EventActivityCreateInput,
      ) => {
        if (!input.inviteAllGuests) {
          return;
        }

        if (builder.isBuilder(input.eventID)) {
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
