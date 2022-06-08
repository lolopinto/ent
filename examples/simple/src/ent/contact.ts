import { GraphQLString } from "graphql";
import { ContactBase } from "./internal";
import {
  PrivacyPolicy,
  AllowIfViewerIsEntPropertyRule,
  AlwaysDenyRule,
} from "@snowtop/ent";
import { gqlField } from "@snowtop/ent/graphql";
import { ContactEmail } from ".";

interface ContactPlusEmails {
  contact: Contact;
  emails: ContactEmail[];
  firstEmail: string;
}

export class Contact extends ContactBase {
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return {
      rules: [new AllowIfViewerIsEntPropertyRule("userID"), AlwaysDenyRule],
    };
  }

  @gqlField({
    type: GraphQLString,
    name: "fullName",
  })
  get fullName(): string {
    return this.firstName + " " + this.lastName;
  }

  async queryPlusEmails(): Promise<ContactPlusEmails> {
    const emails = await this.loadEmails();
    return {
      contact: this,
      emails,
      firstEmail: emails[0].emailAddress,
    };
  }
}
