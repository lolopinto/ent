// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLBoolean,
  GraphQLFieldConfig,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLResolveInfo,
  GraphQLString,
} from "graphql";
import { RequestContext, Viewer } from "@snowtop/ent";
import { GraphQLEdgeConnection, GraphQLTime } from "@snowtop/ent/graphql";
import { RootToCustomTodosConnectionType } from "src/graphql/resolvers/internal";
import { TodoResolver } from "../../resolvers/todos_resolver";

interface CustomTodosArgs {
  completed: boolean | null;
  completed_date: Date | null;
  first: number | null;
  after: string | null;
  last: number | null;
  before: string | null;
}

export const CustomTodosQueryType: GraphQLFieldConfig<
  undefined,
  RequestContext<Viewer>,
  CustomTodosArgs
> = {
  type: new GraphQLNonNull(RootToCustomTodosConnectionType()),
  args: {
    completed: {
      description: "",
      type: GraphQLBoolean,
    },
    completed_date: {
      description: "",
      type: GraphQLTime,
    },
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
      (v) => r.customTodos(context, args.completed, args.completed_date),
      args,
    );
  },
};
