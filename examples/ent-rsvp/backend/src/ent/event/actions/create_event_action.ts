import {
  AllowIfViewerEqualsRule,
  AlwaysDenyRule,
  Data,
  Ent,
  PrivacyPolicy,
} from "@lolopinto/ent";
import { Trigger } from "@lolopinto/ent/action";
import CreateAddressAction from "src/ent/address/actions/create_address_action";
import { NodeType } from "src/ent/const";
import {
  CreateEventActionBase,
  EventCreateInput,
} from "src/ent/event/actions/generated/create_event_action_base";
import { EventBuilder } from "./event_builder";

export { EventCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateEventAction extends CreateEventActionBase {
  getPrivacyPolicy(): PrivacyPolicy {
    return {
      rules: [
        new AllowIfViewerEqualsRule(this.input.creatorID),
        AlwaysDenyRule,
      ],
    };
  }

  triggers: Trigger<Ent>[] = [
    {
      changeset: async (builder: EventBuilder, _input: Data) => {
        if (!this.input.address) {
          return;
        }
        return await CreateAddressAction.create(builder.viewer, {
          ...this.input.address,
          ownerID: builder,
          ownerType: NodeType.Event,
        }).changeset();
      },
    },
  ];
}
