import {
  GraphQLBoolean,
  GraphQLFieldConfigMap,
  GraphQLNonNull,
  GraphQLString,
  GraphQLObjectType,
} from "graphql";
import { RequestContext } from "../../core/context";
import { PaginationInfo } from "../../core/query/query";

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
    startCursor: {
      type: GraphQLNonNull(GraphQLString),
    },
    endCursor: {
      type: GraphQLNonNull(GraphQLString),
    },
  }),
});
