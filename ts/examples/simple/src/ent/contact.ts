import { ContactBase } from "./generated/contact_base";
import { ContactLoader } from "./generated/loaders";
import {
  PrivacyPolicy,
  AllowIfViewerIsRule,
  AlwaysDenyRule,
} from "ent/privacy";
import { gqlField } from "ent/graphql";
//import User from "src/ent/user";
import { UserInterface } from "src/ent/generated/interfaces";

// we're only writing this once except with --force and packageName provided
export default class Contact extends ContactBase {
  privacyPolicy: PrivacyPolicy = {
    rules: [new AllowIfViewerIsRule("userID"), AlwaysDenyRule],
  };

  // nope, can't put interface here wtf
  // now doesn't work once this is added because circular dependency
  @gqlField({ type: "User", nullable: true })
  user(): Promise<UserInterface | null> {
    return this.loadUser();
  }
}
ContactLoader.registerClass(Contact);
