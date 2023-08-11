import { UserBase, Contact, Comment } from "./internal";
import { EdgeType } from "./generated/types";
import {
  AllowIfViewerRule,
  AlwaysDenyRule,
  AllowIfViewerInboundEdgeExistsRule,
  Data,
  PrivacyPolicy,
  ID,
} from "@snowtop/ent";
import { AllowIfOmniRule } from "./../privacy/omni";
import { GraphQLString } from "graphql";
import { gqlConnection, gqlField } from "@snowtop/ent/graphql";
import * as bcrypt from "bcryptjs";
import { CustomEdgeQueryBase } from "@snowtop/ent";
import { ExampleViewer } from "src/viewer/viewer";

class UserToCommentsAuthoredQuery extends CustomEdgeQueryBase<
  User,
  Comment,
  ExampleViewer
> {
  constructor(viewer: ExampleViewer, src: User | ID) {
    super(viewer, {
      src,
      groupCol: "author_id",
      loadEntOptions: Comment.loaderOptions(),
      name: "UserToCommentsAuthored",
    });
  }

  sourceEnt(id: ID) {
    return User.load(this.viewer, id);
  }
}

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
    class: "User",
    type: GraphQLString,
    name: "fullName",
  })
  get fullName(): string {
    return this.firstName + " " + this.lastName;
  }

  @gqlField({
    class: "User",
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
    return Promise.all(
      contacts.map(async (contact) => {
        const contactInfo = await contact.queryPlusEmails();
        return {
          contactInfo,
          contact,
        };
      }),
    );
  }

  @gqlField({
    class: "User",
    type: "Contact",
    nullable: true,
    name: "contactSameDomain",
    description: "contacts same domain...",
    async: true,
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

    for (const info of contactInfos) {
      if (info.contact.id == selfContactEdge?.id2) {
        continue;
      }
      if (domain === this.getDomainFromEmail(info.contactInfo.email1)) {
        return info.contact;
      }
    }
    return null;
  }

  @gqlField({
    class: "User",
    type: "[Contact]",
    name: "contactsSameDomain",
    async: true,
  })
  async getContactsSameDomain(): Promise<Contact[]> {
    // the behavior here is inconsistent but meh
    let domain = this.getDomainFromEmail(this.emailAddress);
    if (!domain) {
      return [];
    }
    const contactInfos = await this.queryContactInfos();
    return contactInfos.filterMap((info) => {
      return {
        include: domain === this.getDomainFromEmail(info.contactInfo.email1),
        return: info.contact,
      };
    });
  }

  @gqlField({
    class: "User",
    type: "[Contact]",
    name: "contactsGivenDomain",
    args: [
      {
        name: "domain",
        type: GraphQLString,
      },
    ],
    async: true,
  })
  async getContactsGivenDomain(domain: string): Promise<Contact[]> {
    const contactInfos = await this.queryContactInfos();
    return contactInfos.filterMap((info) => {
      return {
        include: domain === this.getDomainFromEmail(info.contactInfo.email1),
        return: info.contact,
      };
    });
  }

  @gqlField({
    class: "User",
    type: "[Contact]",
    name: "contactsSameDomainNullable",
    nullable: true,
    async: true,
  })
  async getContactsSameDomainNullable(): Promise<Contact[] | null> {
    // the behavior here is inconsistent but meh
    let domain = this.getDomainFromEmail(this.emailAddress);
    if (!domain) {
      return null;
    }
    const contactInfos = await this.queryContactInfos();
    const res = contactInfos.filterMap((info) => {
      return {
        include:
          this.id !== info.contact.userID &&
          domain === this.getDomainFromEmail(info.contactInfo.email1),
        return: info.contact,
      };
    });

    // cheats and returns null if no contacts
    if (!res.length) {
      return null;
    }
    return res;
  }

  @gqlField({
    class: "User",
    type: "[Contact]",
    name: "contactsSameDomainNullableContents",
    nullable: "contents",
    async: true,
  })
  async getContactsSameDomainNullableContents(): Promise<(Contact | null)[]> {
    // the behavior here is inconsistent but meh
    let domain = this.getDomainFromEmail(this.emailAddress);
    if (!domain) {
      return [];
    }
    let contactInfos = await this.queryContactInfos();
    return contactInfos.map((info) => {
      let contactDomain = this.getDomainFromEmail(info.contactInfo.email1);
      if (contactDomain === domain) {
        return info.contact;
      }
      return null;
    });
  }

  @gqlField({
    class: "User",
    type: "[Contact]",
    name: "contactsSameDomainNullableContentsAndList",
    nullable: "contentsAndList",
    async: true,
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
    return contactInfos.map((info) => {
      let contactDomain = this.getDomainFromEmail(info.contactInfo.email1);
      if (contactDomain === domain) {
        return info.contact;
      }
      return null;
    });
  }

  @gqlField({
    class: "User",
    name: "commentsAuthored",
    type: gqlConnection("Comment"),
  })
  getCommentsAuthored(): UserToCommentsAuthoredQuery {
    return new UserToCommentsAuthoredQuery(this.viewer, this);
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
