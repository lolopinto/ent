import { EventBase } from "./generated/event_base";
import { PrivacyPolicy, AlwaysAllowRule } from "ent/privacy";
import { ObjectType } from "type-graphql";

// we're only writing this once except with --force and packageName provided
@ObjectType()
export default class Event extends EventBase {
  privacyPolicy: PrivacyPolicy = {
    rules: [AlwaysAllowRule],
  };
}
