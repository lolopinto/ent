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

// this is circular dependency issue!
console.log(Contact);
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

  //  @gqlField()
  get fullName(): string {
    return this.firstName + " " + this.lastName;
  }

  @gqlField((type) => GraphQLString, {
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

  // hmm Contact isn't loaded yet?
  // regardless of format!
  // whethere
  @gqlField(
    // (type) => {
    //   console.log("called");
    //   return Contact;
    // },
    {
      type: Contact, // this works with User
      nullable: true,
      name: "contactSameDomain",
    },
  )
  async getFirstContactSameDomain(): Promise<Contact | undefined> {
    let domain = this.getDomainFromEmail(this.emailAddress);
    if (!domain) {
      return;
    }
    let contacts = await this.loadContacts();
    return contacts.find((contact) => {
      if (domain === this.getDomainFromEmail(contact.emailAddress)) {
        return contact;
      }
      return null;
    });
  }

  //  @gqlField({ type: [Contact], name: "contactsSameDomain" })
  async getContactsSameDomain(): Promise<Contact[]> {
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
