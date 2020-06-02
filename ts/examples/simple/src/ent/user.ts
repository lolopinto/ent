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
import { UserLoader } from "./generated/loaders";
//import Contact from "src/schema/contact";
import { ContactInterface } from "./generated/interfaces";

// interface UserInterface {
//   fullName: string;
// }
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

  // nope, can't put interface here wtf
  //  @gqlField({type: ContactInterface})
}

UserLoader.registerClass(User);
