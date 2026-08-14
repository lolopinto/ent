import { gqlField } from "@snowtop/ent/graphql";
import { gqlInterfaceType } from "@snowtop/ent/graphql/graphql";
import { ContactLabel } from "./generated/types.js";
import { Contact } from "./internal.js";

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
  contact(): Contact | null {
    return null;
  }

  constructor(label: ContactLabel) {
    this.label = label;
  }
}
