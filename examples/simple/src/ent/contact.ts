import { GraphQLString } from "graphql";
import { ContactBase } from "./internal";
import {
  PrivacyPolicy,
  AllowIfViewerIsEntPropertyRule,
  AlwaysDenyRule,
} from "@snowtop/ent";
import {
  gqlField,
  gqlObjectType,
  gqlArgType,
  gqlUnionType,
} from "@snowtop/ent/graphql";
import { ContactLabel } from "./generated/types";
import { ContactEmail } from "./internal";

@gqlObjectType()
export class EmailInfo {
  @gqlField({
    class: "EmailInfo",
    type: "[ContactEmail]",
  })
  emails: ContactEmail[];

  @gqlField({ class: "EmailInfo", type: GraphQLString, name: "firstEmail" })
  email1: string;

  constructor(emails: ContactEmail[], firstEmail: string) {
    this.emails = emails;
    this.email1 = firstEmail;
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

  private _contact: Contact | null = null;
  @gqlField({
    class: "ContactDate",
    type: "Contact",
    nullable: true,
  })
  contact(): Contact | null {
    return this._contact;
  }

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
    this._contact = contact;
    this.date = date;
    this.description = description;
  }
}

@gqlUnionType({
  unionTypes: ["ContactEmail", "ContactPhoneNumber", "ContactDate"],
})
export class ContactItemResult {}

@gqlArgType()
export class ContactItemFilter {
  @gqlField({
    class: "ContactItemFilter",
    type: GraphQLString,
    nullable: true,
  })
  emailDomain?: string;

  @gqlField({
    class: "ContactItemFilter",
    type: GraphQLString,
    nullable: true,
  })
  phoneNumberAreaCode?: string;
}

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
