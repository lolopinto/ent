import { GraphQLEnumType } from "graphql";

export const GraphQLOrderByDirection = new GraphQLEnumType({
  name: "OrderByDirection",
  values: {
    ASC: {
      value: "ASC",
    },
    DESC: {
      value: "DESC",
    },
  },
});
