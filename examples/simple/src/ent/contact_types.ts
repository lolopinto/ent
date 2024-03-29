import { GraphQLString } from "graphql";
import { gqlField, gqlObjectType } from "@snowtop/ent/graphql";
import { Contact, ContactEmail } from "./internal";
import { gqlArgType, gqlUnionType } from "@snowtop/ent/graphql/graphql";
import { ContactLabel } from "./generated/types";

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
