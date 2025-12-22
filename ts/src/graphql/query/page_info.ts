import {
  GraphQLBoolean,
  GraphQLFieldConfigMap,
  GraphQLNonNull,
  GraphQLString,
  GraphQLObjectType,
} from "graphql";
import { RequestContext } from "../../core/context.js";
import { PaginationInfo } from "../../core/query/query.js";

// NB: if this changes, need to update renderer.go also
export const GraphQLPageInfo = new GraphQLObjectType({
  name: "PageInfo",
  fields: (): GraphQLFieldConfigMap<PaginationInfo, RequestContext> => ({
    hasNextPage: {
      type: new GraphQLNonNull(GraphQLBoolean),
      resolve: (source: PaginationInfo) => {
        return source.hasNextPage || false;
      },
    },
    hasPreviousPage: {
      type: new GraphQLNonNull(GraphQLBoolean),
      resolve: (source: PaginationInfo) => {
        return source.hasPreviousPage || false;
      },
    },
    startCursor: {
      type: new GraphQLNonNull(GraphQLString),
    },
    endCursor: {
      type: new GraphQLNonNull(GraphQLString),
    },
  }),
});
