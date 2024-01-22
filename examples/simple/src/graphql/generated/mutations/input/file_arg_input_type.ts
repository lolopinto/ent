/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  GraphQLID,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
} from "graphql";

export const FileArgInputType = new GraphQLInputObjectType({
  name: "FileArgInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    id: {
      type: GraphQLID,
    },
    ids: {
      type: new GraphQLList(new GraphQLNonNull(GraphQLID)),
    },
  }),
});
