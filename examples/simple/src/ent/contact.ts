import { GraphQLString } from "graphql";
import { ContactBase } from "./internal";
import {
  PrivacyPolicy,
  AllowIfViewerIsEntPropertyRule,
  AlwaysDenyRule,
} from "@snowtop/ent";
import { gqlField, gqlObjectType } from "@snowtop/ent/graphql";
import { ContactEmail } from ".";

@gqlObjectType()
export class EmailInfo {
  @gqlField({ type: "[ContactEmail]" })
  emails: ContactEmail[];

  @gqlField({ type: GraphQLString })
  firstEmail: string;

  constructor(emails: ContactEmail[], firstEmail: string) {
    this.emails = emails;
    this.firstEmail = firstEmail;
  }
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

  @gqlField({
    type: EmailInfo,
    name: "plusEmails",
  })
  async queryPlusEmails(): Promise<EmailInfo> {
    const emails = await this.loadEmails();
    return {
      emails,
      firstEmail: emails[0].emailAddress,
    };
  }
}
