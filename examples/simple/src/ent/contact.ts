import { GraphQLString } from "graphql";
import { ContactBase } from "./internal";
import {
  PrivacyPolicy,
  AllowIfViewerIsEntPropertyRule,
  AlwaysDenyRule,
} from "@snowtop/ent";
import { gqlField } from "@snowtop/ent/graphql";
import { ContactLabel } from "./generated/types";
import { ContactDate, ContactItemFilter, EmailInfo } from "./contact_types";

export class Contact extends ContactBase {
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return {
      rules: [new AllowIfViewerIsEntPropertyRule("userId"), AlwaysDenyRule],
    };
  }

  @gqlField({
    class: "Contact",
    type: GraphQLString,
    name: "fullName",
  })
  get fullName(): string {
    return this.firstName + " " + this.lastName;
  }

  @gqlField({
    class: "Contact",
    type: "EmailInfo",
    name: "plusEmails",
    async: true,
  })
  async queryPlusEmails(): Promise<EmailInfo> {
    const emails = await this.loadEmails();
    return new EmailInfo(emails, emails[0].emailAddress);
  }

  @gqlField({
    class: "Contact",
    type: "[ContactItemResult]",
    name: "contactItems",
    async: true,
    args: [
      {
        name: "filter",
        type: "ContactItemFilter",
        nullable: true,
      },
    ],
  })
  async queryContactItems(filter?: ContactItemFilter) {
    const [emails, phoneNumbers] = await Promise.all([
      this.loadEmails(),
      this.loadPhoneNumbers(),
    ]);
    return [
      ...emails,
      ...phoneNumbers,
      new ContactDate(ContactLabel.Self, this, this.createdAt, "created_at"),
    ];
  }
}
