import { ContactBase } from "./internal";
import {
  PrivacyPolicy,
  AllowIfViewerIsRule,
  AlwaysDenyRule,
} from "@snowtop/ent";
import { gqlField } from "@snowtop/ent/graphql";
import { ContactEmail } from ".";

interface ContactPlusEmails {
  contact: Contact;
  emails: ContactEmail[];
  firstEmail: string;
}

// we're only writing this once except with --force and packageName provided
export class Contact extends ContactBase {
  privacyPolicy: PrivacyPolicy = {
    rules: [new AllowIfViewerIsRule("userID"), AlwaysDenyRule],
  };

  @gqlField()
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
