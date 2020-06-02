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
//import { ContactInterface } from "./generated/interfaces";
//import Contact from "src/ent/contact";

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

  // nope, can't put interface here
  // works here because no circular dependency but once i make the change
  @gqlField({ type: "Contact" })
  contact() {
    return this.loadSelfContact();
  }
}

UserLoader.registerClass(User);
