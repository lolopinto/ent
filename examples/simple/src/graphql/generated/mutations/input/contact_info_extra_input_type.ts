/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  GraphQLBoolean,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLNonNull,
} from "graphql";
import { ContactInfoSourceType } from "../../../resolvers";

export const ContactInfoExtraInputType = new GraphQLInputObjectType({
  name: "ContactInfoExtraInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    default: {
      type: new GraphQLNonNull(GraphQLBoolean),
    },
    source: {
      type: new GraphQLNonNull(ContactInfoSourceType),
    },
  }),
});
