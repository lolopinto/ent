import { UserBase, Contact, EdgeType } from "./internal";
import {
  PrivacyPolicy,
  AllowIfViewerRule,
  AlwaysDenyRule,
  AllowIfViewerInboundEdgeExistsRule,
  Data,
} from "@snowtop/ent";
import { AllowIfOmniRule } from "./../privacy/omni";
import { GraphQLString } from "graphql";
import { gqlField } from "@snowtop/ent/graphql";
import * as bcrypt from "bcryptjs";

// we're only writing this once except with --force and packageName provided
export class User extends UserBase {
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
      this.queryContacts().queryEnts(),
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
    let contacts = await this.queryContacts().queryEnts();
    return contacts.filter((contact) => {
      return domain === this.getDomainFromEmail(contact.emailAddress);
    });
  }

  @gqlField({
    type: "[Contact]",
    name: "contactsSameDomainNullable",
    nullable: true,
  })
  async getContactsSameDomainNullable(): Promise<Contact[] | null> {
    // the behavior here is inconsistent but meh
    let domain = this.getDomainFromEmail(this.emailAddress);
    if (!domain) {
      return null;
    }
    let contacts = await this.queryContacts().queryEnts();
    contacts = contacts.filter((contact) => {
      return (
        this.id !== contact.userID &&
        domain === this.getDomainFromEmail(contact.emailAddress)
      );
    });
    // cheats and returns null if no contacts
    // doesn't return self contact
    if (!contacts.length) {
      return null;
    }
    return contacts;
  }

  @gqlField({
    type: "[Contact]",
    name: "contactsSameDomainNullableContents",
    nullable: "contents",
  })
  async getContactsSameDomainNullableContents(): Promise<(Contact | null)[]> {
    // the behavior here is inconsistent but meh
    let domain = this.getDomainFromEmail(this.emailAddress);
    if (!domain) {
      return [];
    }
    let contacts = await this.queryContacts().queryEnts();
    return contacts.map((contact) => {
      let contactDomain = this.getDomainFromEmail(contact.emailAddress);
      if (contactDomain === domain) {
        return contact;
      }
      return null;
    });
  }

  @gqlField({
    type: "[Contact]",
    name: "contactsSameDomainNullableContentsAndList",
    nullable: "contentsAndList",
  })
  async getContactsSameDomainNullableContentsAndList(): Promise<
    (Contact | null)[] | null
  > {
    // the behavior here is inconsistent but meh
    let domain = this.getDomainFromEmail(this.emailAddress);
    if (!domain) {
      return null;
    }
    let contacts = await this.queryContacts().queryEnts();
    return contacts.map((contact) => {
      let contactDomain = this.getDomainFromEmail(contact.emailAddress);
      if (contactDomain === domain) {
        return contact;
      }
      return null;
    });
  }

  static async validateEmailPassword(
    email: string,
    password: string,
  ): Promise<Data | null> {
    // TODO loadRawDataFromEmailAddress should eventually be optional incase someone wants to hide this
    // as a public API
    const data = await User.loadRawDataFromEmailAddress(email);
    if (!data) {
      return null;
    }
    let valid = await bcrypt.compare(password, data.password || "");
    return valid ? data : null;
  }
}
