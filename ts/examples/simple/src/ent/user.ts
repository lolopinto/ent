import { UserBase } from "./generated/user_base";
import {
  PrivacyPolicy,
  AllowIfViewerRule,
  AlwaysDenyRule,
  AllowIfViewerInboundEdgeExistsRule,
} from "ent/privacy";
import { AllowIfOmniRule } from "./../privacy/omni";
import { EdgeType } from "./const";
import { gqlField } from "ent/graphql";
import { GraphQLString } from "graphql";

// we're only writing this once except with --force and packageName provided
export default class User extends UserBase {
  privacyPolicy: PrivacyPolicy = {
    rules: [
      AllowIfOmniRule,
      AllowIfViewerRule,
      new AllowIfViewerInboundEdgeExistsRule(EdgeType.UserToFriends),
      AlwaysDenyRule,
    ],
  };

  @gqlField()
  get fullName(): string {
    return this.firstName + " " + this.lastName;
  }

  @gqlField({ type: GraphQLString, nullable: true, name: "bar" })
  getUserBar(): string | null {
    if (this.viewer.viewerID === this.id) {
      return this.viewer.viewerID.toString();
    }
    return null;
  }
}
