/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLNonNull,
  GraphQLString,
} from "graphql";

export const UserPrefsDiffInputType = new GraphQLInputObjectType({
  name: "UserPrefsDiffInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    type: {
      type: new GraphQLNonNull(GraphQLString),
    },
  }),
});
