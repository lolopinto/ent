// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLNonNull,
  GraphQLString,
} from "graphql";

const CountryCapitalInputType = new GraphQLInputObjectType({
  name: "CountryCapitalInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    name: {
      type: new GraphQLNonNull(GraphQLString),
    },
    population: {
      type: new GraphQLNonNull(GraphQLString),
    },
  }),
});

export const CountryInputType = new GraphQLInputObjectType({
  name: "CountryInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    name: {
      type: new GraphQLNonNull(GraphQLString),
    },
    code: {
      type: new GraphQLNonNull(GraphQLString),
    },
    capital: {
      type: new GraphQLNonNull(CountryCapitalInputType),
    },
  }),
});
