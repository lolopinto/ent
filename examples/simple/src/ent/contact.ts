import { GraphQLString } from "graphql";
import { ContactBase } from "./internal";
import {
  PrivacyPolicy,
  AllowIfViewerIsEntPropertyRule,
  AlwaysDenyRule,
} from "@snowtop/ent";
import { gqlField, gqlObjectType } from "@snowtop/ent/graphql";
import { ContactEmail } from ".";
import { gqlUnionType } from "@snowtop/ent/graphql/graphql";
import { ContactLabel } from "./generated/types";

@gqlObjectType()
export class EmailInfo {
  @gqlField({
    class: "EmailInfo",
    type: "[ContactEmail]",
  })
  emails: ContactEmail[];

  @gqlField({ class: "EmailInfo", type: GraphQLString })
  firstEmail: string;

  constructor(emails: ContactEmail[], firstEmail: string) {
    this.emails = emails;
    this.firstEmail = firstEmail;
  }
}

@gqlObjectType({
  interfaces: ["ContactItem"],
})
export class ContactDate {
  @gqlField({
    class: "ContactDate",
    type: "ContactLabel",
  })
  label: ContactLabel;

  @gqlField({
    class: "ContactDate",
    type: "Contact",
    nullable: true,
  })
  contact: Contact | null = null;

  @gqlField({
    class: "ContactDate",
    type: "Date",
  })
  date: Date;

  @gqlField({
    class: "ContactDate",
    type: GraphQLString,
  })
  description: string;

  constructor(
    label: ContactLabel,
    contact: Contact | null = null,
    date: Date,
    description: string,
  ) {
    this.label = label;
    this.contact = contact;
    this.date = date;
    this.description = description;
  }
}

@gqlUnionType({
  unionTypes: ["ContactEmail", "ContactPhoneNumber", "ContactDate"],
})
export class ContactItemResult {}

export class Contact extends ContactBase {
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return {
      rules: [new AllowIfViewerIsEntPropertyRule("userID"), AlwaysDenyRule],
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
    return {
      emails,
      firstEmail: emails[0].emailAddress,
    };
  }

  @gqlField({
    class: "Contact",
    type: "[ContactItemResult]",
    name: "contactItems",
    async: true,
  })
  async queryContactItems() {
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
