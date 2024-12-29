/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  GraphQLID,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLNonNull,
  GraphQLString,
} from "graphql";
import { GraphQLTime } from "@snowtop/ent/graphql";

export const AttachmentInputType = new GraphQLInputObjectType({
  name: "AttachmentInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    fileId: {
      type: new GraphQLNonNull(GraphQLID),
    },
    dupeFileId: {
      type: GraphQLID,
    },
    note: {
      type: GraphQLString,
    },
    date: {
      type: new GraphQLNonNull(GraphQLTime),
    },
    phoneNumber: {
      type: GraphQLString,
    },
    emailAddress: {
      type: GraphQLString,
    },
    creatorId: {
      type: GraphQLID,
    },
    creatorType: {
      type: GraphQLString,
    },
  }),
});
