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
  GraphQLString,
} from "graphql";
import { RequestContext, Viewer } from "@snowtop/ent";
import { Todo } from "src/ent/";
import RenameTodoStatusAction, {
  RenameTodoInput,
} from "src/ent/todo/actions/rename_todo_status_action";
import { TodoType } from "src/graphql/resolvers/";

interface customRenameTodoInput
  extends Omit<RenameTodoInput, "reasonForChange"> {
  id: string;
  reason_for_change?: string | null;
}

interface RenameTodoPayload {
  todo: Todo;
}

export const RenameTodoInputType = new GraphQLInputObjectType({
  name: "RenameTodoInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    id: {
      description: "id of Todo",
      type: new GraphQLNonNull(GraphQLID),
    },
    text: {
      type: GraphQLString,
    },
    reason_for_change: {
      type: GraphQLString,
    },
  }),
});

export const RenameTodoPayloadType = new GraphQLObjectType({
  name: "RenameTodoPayload",
  fields: (): GraphQLFieldConfigMap<
    RenameTodoPayload,
    RequestContext<Viewer>
  > => ({
    todo: {
      type: new GraphQLNonNull(TodoType),
    },
  }),
});

export const RenameTodoType: GraphQLFieldConfig<
  undefined,
  RequestContext<Viewer>,
  { [input: string]: customRenameTodoInput }
> = {
  type: new GraphQLNonNull(RenameTodoPayloadType),
  args: {
    input: {
      description: "",
      type: new GraphQLNonNull(RenameTodoInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext<Viewer>,
    _info: GraphQLResolveInfo,
  ): Promise<RenameTodoPayload> => {
    const todo = await RenameTodoStatusAction.saveXFromID(
      context.getViewer(),
      input.id,
      {
        text: input.text,
        reasonForChange: input.reason_for_change,
      },
    );
    return { todo };
  },
};
