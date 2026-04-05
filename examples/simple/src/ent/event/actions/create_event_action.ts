import { CreateEventActionBase } from "../../generated/event/actions/create_event_action_base";
import type { EventCreateInput } from "../../generated/event/actions/create_event_action_base";
import type { Trigger, Validator } from "@snowtop/ent/action";
import { SharedValidators } from "./event_validators";
import { EventBuilder } from "../../generated/event/actions/event_builder";
import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import type { PrivacyPolicy } from "@snowtop/ent";
import { Event } from "../../../ent";
import { ExampleViewer } from "../../../viewer/viewer";
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
