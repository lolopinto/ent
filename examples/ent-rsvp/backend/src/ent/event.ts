import { AlwaysAllowRule, PrivacyPolicy } from "@snowtop/ent";
import { EventBase } from "src/ent/internal";

// we're only writing this once except with --force and packageName provided
export class Event extends EventBase {
  privacyPolicy: PrivacyPolicy = {
    // TODO only invited or only creator instead of everyone...
    rules: [AlwaysAllowRule],
  };
}
