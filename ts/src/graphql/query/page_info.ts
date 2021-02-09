import {
  GraphQLBoolean,
  GraphQLFieldConfigMap,
  GraphQLNonNull,
  GraphQLObjectType,
} from "graphql";
import { RequestContext } from "../../core/context";
import { PaginationInfo } from "../../core/query/assoc_query";

export const GraphQLPageInfo = new GraphQLObjectType({
  name: "PageInfo",
  fields: (): GraphQLFieldConfigMap<PaginationInfo, RequestContext> => ({
    hasNextPage: {
      type: GraphQLNonNull(GraphQLBoolean),
      resolve: (source: PaginationInfo) => {
        return source.hasNextPage || false;
      },
    },
    hasPreviousPage: {
      type: GraphQLNonNull(GraphQLBoolean),
      resolve: (source: PaginationInfo) => {
        return source.hasPreviousPage || false;
      },
    },
  }),
});
