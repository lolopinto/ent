/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  GraphQLBoolean,
  GraphQLFieldConfigMap,
  GraphQLNonNull,
  GraphQLObjectType,
} from "graphql";
import { RequestContext } from "@snowtop/ent";
import { ContactInfo } from "../../../ent";
import { ContactInfoSourceType } from "../../resolvers/internal";

export const ContactInfoType = new GraphQLObjectType({
  name: "ContactInfo",
  fields: (): GraphQLFieldConfigMap<ContactInfo, RequestContext> => ({
    default: {
      type: new GraphQLNonNull(GraphQLBoolean),
    },
    source: {
      type: new GraphQLNonNull(ContactInfoSourceType),
    },
  }),
});
