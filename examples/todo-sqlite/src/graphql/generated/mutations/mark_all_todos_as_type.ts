// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLBoolean,
  GraphQLFieldConfig,
  GraphQLID,
  GraphQLNonNull,
  GraphQLResolveInfo,
} from "graphql";
import { RequestContext, Viewer } from "@snowtop/ent";
import { AccountType } from "src/graphql/resolvers/";
import { TodosResolver } from "../../mutations/todo/todo_resolver";

interface MarkAllTodosAsArgs {
  accountID: any;
  completed: boolean;
}

export const MarkAllTodosAsType: GraphQLFieldConfig<
  undefined,
  RequestContext<Viewer>,
  MarkAllTodosAsArgs
> = {
  type: new GraphQLNonNull(AccountType),
  args: {
    accountID: {
      description: "",
      type: new GraphQLNonNull(GraphQLID),
    },
    completed: {
      description: "",
      type: new GraphQLNonNull(GraphQLBoolean),
    },
  },
  resolve: async (
    _source,
    args,
    context: RequestContext<Viewer>,
    _info: GraphQLResolveInfo,
  ) => {
    const r = new TodosResolver();
    return r.markAllTodos(args.accountID, args.completed);
  },
};
