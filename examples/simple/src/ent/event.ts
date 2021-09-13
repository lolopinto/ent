import { EventBase } from "./internal";
import { PrivacyPolicy, AlwaysAllowRule } from "@snowtop/ent";

// we're only writing this once except with --force and packageName provided
export class Event extends EventBase {
  privacyPolicy: PrivacyPolicy = {
    rules: [AlwaysAllowRule],
  };
}
