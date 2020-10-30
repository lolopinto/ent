import {
  GraphQLBoolean,
  GraphQLFieldConfigMap,
  GraphQLNonNull,
  GraphQLObjectType,
} from "graphql";
import { RequestContext } from "../../core/context";
import { PaginationInfo } from "../../core/query";

export const GraphQLPageInfo = new GraphQLObjectType({
  name: "PageInfo",
  fields: (): GraphQLFieldConfigMap<PaginationInfo, RequestContext> => ({
    hasNextPage: {
      type: GraphQLNonNull(GraphQLBoolean),
    },
    hasPreviousPage: {
      type: GraphQLNonNull(GraphQLBoolean),
    },
  }),
});
