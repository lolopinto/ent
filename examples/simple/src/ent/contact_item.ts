import { gqlField } from "@snowtop/ent/graphql";
import { gqlInterfaceType } from "@snowtop/ent/graphql/graphql";
import { ContactLabel } from "./generated/types";
import { Contact } from "./internal";

@gqlInterfaceType({})
export class ContactItem {
  @gqlField({
    class: "ContactItem",
    type: "ContactLabel",
  })
  label: ContactLabel;

  @gqlField({
    class: "ContactItem",
    type: "Contact",
    nullable: true,
  })
  contact: Contact | null = null;

  constructor(label: ContactLabel) {
    this.label = label;
  }
}
