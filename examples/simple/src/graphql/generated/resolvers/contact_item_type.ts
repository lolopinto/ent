/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import { GraphQLInterfaceType, GraphQLNonNull } from "graphql";
import { ContactLabelType, ContactType } from "../../resolvers/internal";

export const ContactItemType = new GraphQLInterfaceType({
  name: "ContactItem",
  fields: () => ({
    label: {
      type: new GraphQLNonNull(ContactLabelType),
    },
    contact: {
      type: new GraphQLNonNull(ContactType),
    },
  }),
});
