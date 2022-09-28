// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLFieldConfig,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLResolveInfo,
  GraphQLString,
} from "graphql";
import { RequestContext, Viewer } from "@snowtop/ent";
import { GraphQLEdgeConnection } from "@snowtop/ent/graphql";
import { RootToClosedTodosLastDayConnectionType } from "src/graphql/resolvers/internal";
import { TodoResolver } from "../../resolvers/todos_resolver";

interface ClosedTodosLastDayArgs {
  first?: number | null;
  after?: string | null;
  last?: number | null;
  before?: string | null;
}

export const ClosedTodosLastDayQueryType: GraphQLFieldConfig<
  undefined,
  RequestContext<Viewer>,
  ClosedTodosLastDayArgs
> = {
  type: new GraphQLNonNull(RootToClosedTodosLastDayConnectionType()),
  args: {
    first: {
      description: "",
      type: GraphQLInt,
    },
    after: {
      description: "",
      type: GraphQLString,
    },
    last: {
      description: "",
      type: GraphQLInt,
    },
    before: {
      description: "",
      type: GraphQLString,
    },
  },
  resolve: async (
    _source,
    args,
    context: RequestContext<Viewer>,
    _info: GraphQLResolveInfo,
  ) => {
    const r = new TodoResolver();
    return new GraphQLEdgeConnection(
      context.getViewer(),
      (v) => r.closedTodosLastDay(context),
      args,
    );
  },
};
