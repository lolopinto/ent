import { EventBase } from "./generated/event_base";
import { PrivacyPolicy, AlwaysAllowRule } from "ent/privacy";
import { EventLoader } from "./generated/loaders";

// we're only writing this once except with --force and packageName provided
export default class Event extends EventBase {
  privacyPolicy: PrivacyPolicy = {
    rules: [AlwaysAllowRule],
  };
}

EventLoader.registerClass(Event);
