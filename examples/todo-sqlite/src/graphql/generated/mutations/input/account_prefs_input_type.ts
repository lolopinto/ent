// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLBoolean,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLNonNull,
  GraphQLString,
} from "graphql";

export const AccountPrefsInputType = new GraphQLInputObjectType({
  name: "AccountPrefsInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    finished_nux: {
      type: new GraphQLNonNull(GraphQLBoolean),
    },
    enable_notifs: {
      type: new GraphQLNonNull(GraphQLBoolean),
    },
    preferred_language: {
      type: new GraphQLNonNull(GraphQLString),
    },
  }),
});
