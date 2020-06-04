import { UserBase } from "./generated/user_base";
import {
  PrivacyPolicy,
  AllowIfViewerRule,
  AlwaysDenyRule,
  AllowIfViewerInboundEdgeExistsRule,
} from "ent/privacy";
import { AllowIfOmniRule } from "./../privacy/omni";
import { EdgeType } from "./const";
import { GraphQLString } from "graphql";
import Contact from "src/ent/contact";
import { gqlField } from "ent/graphql";

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

  @gqlField({
    type: GraphQLString,
    nullable: true,
    name: "bar",
  })
  getUserBar(): string | null {
    if (this.viewer.viewerID === this.id) {
      return this.viewer.viewerID.toString();
    }
    return null;
  }

  private getDomainFromEmail(emailAddress: string) {
    let parts = emailAddress.split("@");
    if (parts.length > 1) {
      return parts[parts.length - 1];
    }
    return null;
  }

  @gqlField({
    type: "Contact",
    nullable: true,
    name: "contactSameDomain",
  })
  async getFirstContactSameDomain(): Promise<Contact | undefined> {
    let domain = this.getDomainFromEmail(this.emailAddress);
    if (!domain) {
      return;
    }
    let [selfContactEdge, contacts] = await Promise.all([
      this.loadSelfContactEdge(),
      this.loadContacts(),
    ]);
    return contacts!.find((contact) => {
      if (selfContactEdge?.id2 === contact.id) {
        return null;
      }
      if (domain === this.getDomainFromEmail(contact.emailAddress)) {
        return contact;
      }
      return null;
    });
  }

  @gqlField({ type: "[Contact]", name: "contactsSameDomain" })
  async getContactsSameDomain(): Promise<Contact[]> {
    // the behavior here is inconsistent but meh
    let domain = this.getDomainFromEmail(this.emailAddress);
    if (!domain) {
      return [];
    }
    let contacts = await this.loadContacts();
    return contacts.filter((contact) => {
      return domain === this.getDomainFromEmail(contact.emailAddress);
    });
  }
}
