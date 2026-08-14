import { CreateEventActionBase } from "../../generated/event/actions/create_event_action_base.js";
import type { EventCreateInput } from "../../generated/event/actions/create_event_action_base.js";
import type { Trigger, Validator } from "@snowtop/ent/action";
import { SharedValidators } from "./event_validators.js";
import { EventBuilder } from "../../generated/event/actions/event_builder.js";
import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import type { PrivacyPolicy } from "@snowtop/ent";
import { Event } from "../../index.js";
import { ExampleViewer } from "../../../viewer/viewer.js";
export type { EventCreateInput };
// we're only writing this once except with --force and packageName provided
export default class CreateEventAction extends CreateEventActionBase {
  getPrivacyPolicy(): PrivacyPolicy {
    // TODO can make this better and only do this if viewer is creatorID
    // use AllowIfViewerEqualsRule
    return AlwaysAllowPrivacyPolicy;
  }

  getValidators(): Validator<
    Event,
    EventBuilder<EventCreateInput, Event | null>,
    ExampleViewer,
    EventCreateInput,
    Event | null
  >[] {
    return [...SharedValidators];
  }

  getTriggers(): Trigger<
    Event,
    EventBuilder<EventCreateInput, Event | null>,
    ExampleViewer,
    EventCreateInput,
    Event | null
  >[] {
    return [
      {
        changeset(
          builder: EventBuilder<EventCreateInput>,
          input: EventCreateInput,
        ) {
          builder.addHostID(input.creatorId);
        },
      },
    ];
  }
}
