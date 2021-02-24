import { Data, Ent, AlwaysDenyRule } from "@lolopinto/ent";
import {
  CreateEventActivityActionBase,
  EventActivityCreateInput,
} from "src/ent/event_activity/actions/generated/create_event_activity_action_base";
import { AllowIfEventCreatorPrivacyPolicy } from "src/ent/event/privacy/event_creator";
export { EventActivityCreateInput };
import { Trigger } from "@lolopinto/ent/action";
import CreateAddressAction from "src/ent/address/actions/create_address_action";
import { NodeType } from "src/ent/const";
import { EventActivityBuilder } from "./event_activity_builder";

// we're only writing this once except with --force and packageName provided
export default class CreateEventActivityAction extends CreateEventActivityActionBase {
  getPrivacyPolicy() {
    // only creator of event can create activity
    return new AllowIfEventCreatorPrivacyPolicy(this.input.eventID);
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
  ];
}
