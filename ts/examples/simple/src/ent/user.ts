import { Field, Int, ObjectType } from "type-graphql";
import { UserBase, AccountStatus } from "./generated/user_base";
import {
  PrivacyPolicy,
  AllowIfViewerRule,
  AlwaysDenyRule,
  AllowIfViewerInboundEdgeExistsRule,
} from "ent/privacy";
import { AllowIfOmniRule } from "./../privacy/omni";
import { EdgeType } from "./const";

// if new enums are added after the fact, we can't automatically export it here :(
// based on what we're currently doing
export { AccountStatus };

// we're only writing this once except with --force and packageName provided
@ObjectType()
export default class User extends UserBase {
  privacyPolicy: PrivacyPolicy = {
    rules: [
      AllowIfOmniRule,
      AllowIfViewerRule,
      new AllowIfViewerInboundEdgeExistsRule(EdgeType.UserToFriends),
      AlwaysDenyRule,
    ],
  };
}
