// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLBoolean,
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLID,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLResolveInfo,
} from "graphql";
import { RequestContext, Viewer } from "@snowtop/ent";
import { Todo } from "src/ent/";
import ChangeTodoStatusAction, {
  ChangeTodoStatusInput,
} from "src/ent/todo/actions/change_todo_status_action";
import { TodoType } from "src/graphql/resolvers/";

interface customChangeTodoStatusInput extends ChangeTodoStatusInput {
  id: string;
}

interface ChangeTodoStatusPayload {
  todo: Todo;
}

export const ChangeTodoStatusInputType = new GraphQLInputObjectType({
  name: "ChangeTodoStatusInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    id: {
      description: "id of Todo",
      type: new GraphQLNonNull(GraphQLID),
    },
    completed: {
      type: GraphQLBoolean,
    },
  }),
});

export const ChangeTodoStatusPayloadType = new GraphQLObjectType({
  name: "ChangeTodoStatusPayload",
  fields: (): GraphQLFieldConfigMap<
    ChangeTodoStatusPayload,
    RequestContext
  > => ({
    todo: {
      type: new GraphQLNonNull(TodoType),
    },
  }),
});

export const ChangeTodoStatusType: GraphQLFieldConfig<
  undefined,
  RequestContext<Viewer>,
  { [input: string]: customChangeTodoStatusInput }
> = {
  type: new GraphQLNonNull(ChangeTodoStatusPayloadType),
  args: {
    input: {
      description: "",
      type: new GraphQLNonNull(ChangeTodoStatusInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext<Viewer>,
    _info: GraphQLResolveInfo,
  ): Promise<ChangeTodoStatusPayload> => {
    const todo = await ChangeTodoStatusAction.saveXFromID(
      context.getViewer(),
      input.id,
      {
        completed: input.completed,
      },
    );
    return { todo: todo };
  },
};
