/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  GraphQLFieldConfigMap,
  GraphQLID,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from "graphql";
import { RequestContext } from "@snowtop/ent";
import { GraphQLNodeInterface, nodeIDEncoder } from "@snowtop/ent/graphql";
import { ContactEmail } from "../../../ent";
import { ContactType } from "../internal";

export const ContactEmailType = new GraphQLObjectType({
  name: "ContactEmail",
  fields: (): GraphQLFieldConfigMap<ContactEmail, RequestContext> => ({
    contact: {
      type: ContactType,
      resolve: (
        contactEmail: ContactEmail,
        args: {},
        context: RequestContext,
      ) => {
        return contactEmail.loadContact();
      },
    },
    id: {
      type: GraphQLNonNull(GraphQLID),
      resolve: nodeIDEncoder,
    },
    emailAddress: {
      type: GraphQLNonNull(GraphQLString),
    },
    label: {
      type: GraphQLNonNull(GraphQLString),
    },
  }),
  interfaces: [GraphQLNodeInterface],
  isTypeOf(obj) {
    return obj instanceof ContactEmail;
  },
});
