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
import { Account } from "src/ent/";
import {
  EditAccountTodoStatusAction,
  EditAccountTodoStatusInput,
} from "src/ent/account/actions/edit_account_todo_status_action";
import { AccountTodoStatusInput } from "src/ent/generated/account/actions/edit_account_todo_status_action_base";
import { AccountTodoStatusInputType } from "src/graphql/generated/mutations/input_enums_type";
import { AccountType } from "src/graphql/resolvers/";

interface customTodoStatusAccountEditInput
  extends Omit<EditAccountTodoStatusInput, "todoStatus"> {
  id: string;
  todo_status: AccountTodoStatusInput;
  todo_id: string;
}

interface TodoStatusAccountEditPayload {
  account: Account;
}

export const TodoStatusAccountEditInputType = new GraphQLInputObjectType({
  name: "TodoStatusAccountEditInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    id: {
      description: "id of Account",
      type: new GraphQLNonNull(GraphQLID),
    },
    todo_status: {
      type: new GraphQLNonNull(AccountTodoStatusInputType),
    },
    todo_id: {
      type: new GraphQLNonNull(GraphQLID),
    },
  }),
});

export const TodoStatusAccountEditPayloadType = new GraphQLObjectType({
  name: "TodoStatusAccountEditPayload",
  fields: (): GraphQLFieldConfigMap<
    TodoStatusAccountEditPayload,
    RequestContext<Viewer>
  > => ({
    account: {
      type: new GraphQLNonNull(AccountType),
    },
  }),
});

export const TodoStatusAccountEditType: GraphQLFieldConfig<
  undefined,
  RequestContext<Viewer>,
  { [input: string]: customTodoStatusAccountEditInput }
> = {
  type: new GraphQLNonNull(TodoStatusAccountEditPayloadType),
  args: {
    input: {
      description: "",
      type: new GraphQLNonNull(TodoStatusAccountEditInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext<Viewer>,
    _info: GraphQLResolveInfo,
  ): Promise<TodoStatusAccountEditPayload> => {
    const account = await EditAccountTodoStatusAction.saveXFromID(
      context.getViewer(),
      input.id,
      {
        todoStatus: input.todo_status,
        todoId: input.todo_id,
      },
    );
    return { account };
  },
};
