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
import { RequestContext, Viewer } from "@snowtop/ent";
import { Todo } from "src/ent/";
import TodoRemoveTagAction from "src/ent/todo/actions/todo_remove_tag_action";
import { TodoType } from "src/graphql/resolvers/";

interface customRemoveTodoTagInput {
  id: string;
  tag_id: string;
}

interface RemoveTodoTagPayload {
  todo: Todo;
}

export const RemoveTodoTagInputType = new GraphQLInputObjectType({
  name: "RemoveTodoTagInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    id: {
      description: "id of Todo",
      type: new GraphQLNonNull(GraphQLID),
    },
    tag_id: {
      type: new GraphQLNonNull(GraphQLID),
    },
  }),
});

export const RemoveTodoTagPayloadType = new GraphQLObjectType({
  name: "RemoveTodoTagPayload",
  fields: (): GraphQLFieldConfigMap<
    RemoveTodoTagPayload,
    RequestContext<Viewer>
  > => ({
    todo: {
      type: new GraphQLNonNull(TodoType),
    },
  }),
});

export const RemoveTodoTagType: GraphQLFieldConfig<
  undefined,
  RequestContext<Viewer>,
  { [input: string]: customRemoveTodoTagInput }
> = {
  type: new GraphQLNonNull(RemoveTodoTagPayloadType),
  args: {
    input: {
      description: "",
      type: new GraphQLNonNull(RemoveTodoTagInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext<Viewer>,
    _info: GraphQLResolveInfo,
  ): Promise<RemoveTodoTagPayload> => {
    const todo = await TodoRemoveTagAction.saveXFromID(
      context.getViewer(),
      input.id,
      input.tag_id,
    );
    return { todo };
  },
};
