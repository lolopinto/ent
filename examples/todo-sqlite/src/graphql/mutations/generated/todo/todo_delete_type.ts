// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLID,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLResolveInfo,
} from "graphql";
import { RequestContext } from "@snowtop/ent";
import DeleteTodoAction from "src/ent/todo/actions/delete_todo_action";

interface customTodoDeleteInput {
  todoID: string;
}

interface TodoDeletePayload {
  deletedTodoID: string;
}

export const TodoDeleteInputType = new GraphQLInputObjectType({
  name: "TodoDeleteInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    todoID: {
      type: GraphQLNonNull(GraphQLID),
    },
  }),
});

export const TodoDeletePayloadType = new GraphQLObjectType({
  name: "TodoDeletePayload",
  fields: (): GraphQLFieldConfigMap<TodoDeletePayload, RequestContext> => ({
    deletedTodoID: {
      type: GraphQLID,
    },
  }),
});

export const TodoDeleteType: GraphQLFieldConfig<
  undefined,
  RequestContext,
  { [input: string]: customTodoDeleteInput }
> = {
  type: GraphQLNonNull(TodoDeletePayloadType),
  args: {
    input: {
      description: "",
      type: GraphQLNonNull(TodoDeleteInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ): Promise<TodoDeletePayload> => {
    await DeleteTodoAction.saveXFromID(context.getViewer(), input.todoID);
    return { deletedTodoID: input.todoID };
  },
};
