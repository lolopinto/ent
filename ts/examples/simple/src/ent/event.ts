import { EventBase } from "./generated/event_base";
import { PrivacyPolicy, AlwaysAllowRule } from "ent/core/privacy";

// we're only writing this once except with --force and packageName provided
export default class Event extends EventBase {
  privacyPolicy: PrivacyPolicy = {
    rules: [AlwaysAllowRule],
  };
}
