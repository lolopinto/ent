import {
  GraphQLFieldConfig,
  GraphQLID,
  GraphQLNonNull,
  GraphQLResolveInfo,
} from "graphql";
import { RequestContext } from "@snowtop/ent";
import { Todo } from "src/ent/";
import { TodoType } from "src/graphql/resolvers/internal";

interface TodoQueryArgs {
  id: string;
}

export const TodoQueryType: GraphQLFieldConfig<
  undefined,
  RequestContext,
  TodoQueryArgs
> = {
  type: TodoType,
  args: {
    id: {
      description: "",
      type: GraphQLNonNull(GraphQLID),
    },
  },
  resolve: async (
    _source,
    args: TodoQueryArgs,
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ) => {
    return Todo.load(context.getViewer(), args.id);
  },
};
