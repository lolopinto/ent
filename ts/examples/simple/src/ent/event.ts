import { EventBase } from "src/ent/internal";
import { PrivacyPolicy, AlwaysAllowRule } from "@lolopinto/ent";

// we're only writing this once except with --force and packageName provided
export class Event extends EventBase {
  privacyPolicy: PrivacyPolicy = {
    rules: [AlwaysAllowRule],
  };
}
