import { GraphQLEnumType } from "graphql";

export const GraphQLOrderByDirection = new GraphQLEnumType({
  name: "OrderByDirection",
  values: {
    ASC: {
      value: "asc",
    },
    DESC: {
      value: "desc",
    },
  },
});
