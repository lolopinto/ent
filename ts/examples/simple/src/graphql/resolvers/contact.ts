import {
  //  graphql,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLID,
  GraphQLString,
  GraphQLEnumType,
  GraphQLNonNull,
} from "graphql";

export const contactType = new GraphQLObjectType({
  name: "Contact",
  description: "Contact",
  fields: () => ({
    id: {
      type: GraphQLNonNull(GraphQLID),
      description: "id",
    },
    firstName: {
      type: GraphQLNonNull(GraphQLString),
      description: "first name",
    },
    lastName: {
      type: GraphQLNonNull(GraphQLString),
      description: "last name",
    },
    emailAddress: {
      type: GraphQLNonNull(GraphQLString),
      description: "emailAddress",
    },
  }),
});
