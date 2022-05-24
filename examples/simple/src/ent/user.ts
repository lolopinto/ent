import { UserBase, Contact, EdgeType } from "./internal";
import {
  AllowIfViewerRule,
  AlwaysDenyRule,
  AllowIfViewerInboundEdgeExistsRule,
  Data,
  PrivacyPolicy,
} from "@snowtop/ent";
import { AllowIfOmniRule } from "./../privacy/omni";
import { GraphQLString } from "graphql";
import { gqlField } from "@snowtop/ent/graphql";
import * as bcrypt from "bcryptjs";

// we're only writing this once except with --force and packageName provided
export class User extends UserBase {
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return {
      rules: [
        AllowIfOmniRule,
        AllowIfViewerRule,
        new AllowIfViewerInboundEdgeExistsRule(EdgeType.UserToFriends),
        AlwaysDenyRule,
      ],
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

  private async queryContactInfos() {
    const contacts = await this.queryContacts().queryEnts();
    return Promise.all(contacts.map((contact) => contact.queryPlusEmails()));
  }

  @gqlField({
    type: "Contact",
    nullable: true,
    name: "contactSameDomain",
  })
  async getFirstContactSameDomain(): Promise<Contact | null> {
    let domain = this.getDomainFromEmail(this.emailAddress);
    if (!domain) {
      return null;
    }
    let [selfContactEdge, contactInfos] = await Promise.all([
      this.loadSelfContactEdge(),
      this.queryContactInfos(),
    ]);

    const ret = contactInfos.find((contactInfo) => {
      if (selfContactEdge?.id2 === contactInfo.contact.id) {
        return null;
      }
      if (domain === this.getDomainFromEmail(contactInfo.firstEmail)) {
        return contactInfo;
      }
    });
    return ret?.contact || null;
  }

  @gqlField({ type: "[Contact]", name: "contactsSameDomain" })
  async getContactsSameDomain(): Promise<Contact[]> {
    // the behavior here is inconsistent but meh
    let domain = this.getDomainFromEmail(this.emailAddress);
    if (!domain) {
      return [];
    }
    const contactInfos = await this.queryContactInfos();
    return contactInfos
      .filter((contactInfo) => {
        return domain === this.getDomainFromEmail(contactInfo.firstEmail);
      })
      .map((info) => info.contact);
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
    const contactInfos = await this.queryContactInfos();
    const res = contactInfos
      .filter((contactInfo) => {
        return (
          this.id !== contactInfo.contact.userID &&
          domain === this.getDomainFromEmail(contactInfo.firstEmail)
        );
      })
      .map((info) => info.contact);
    // cheats and returns null if no contacts
    if (!res.length) {
      return null;
    }
    return res;
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
    let contactInfos = await this.queryContactInfos();
    return contactInfos.map((contactInfo) => {
      let contactDomain = this.getDomainFromEmail(contactInfo.firstEmail);
      if (contactDomain === domain) {
        return contactInfo.contact;
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
    const contactInfos = await this.queryContactInfos();
    return contactInfos.map((contactInfo) => {
      let contactDomain = this.getDomainFromEmail(contactInfo.firstEmail);
      if (contactDomain === domain) {
        return contactInfo.contact;
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
