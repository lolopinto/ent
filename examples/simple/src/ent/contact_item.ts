import { gqlField } from "@snowtop/ent/graphql";
import { gqlInterfaceType } from "@snowtop/ent/graphql/graphql";
import { ContactLabel } from "./generated/types";
import { Contact } from "./internal";

@gqlInterfaceType({})
export class ContactItem {
  @gqlField({
    nodeName: "ContactItem",
    // TODO custom enum|graphql objects should be passed
    type: "ContactLabel",
  })
  label: ContactLabel;

  @gqlField({
    nodeName: "ContactItem",
    type: "Contact",
  })
  contact: Contact;

  constructor(label: ContactLabel, contact: Contact) {
    this.label = label;
    this.contact = contact;
  }
}
