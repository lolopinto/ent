// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { GraphQLSchema } from "graphql";
import {
  AccountTransferCreditsInputType,
  AccountTransferCreditsPayloadType,
} from "src/graphql/generated/mutations/account/account_transfer_credits_type";
import {
  AccountUpdateBalanceInputType,
  AccountUpdateBalancePayloadType,
} from "src/graphql/generated/mutations/account/account_update_balance_type";
import {
  CreateAccountInputType,
  CreateAccountPayloadType,
} from "src/graphql/generated/mutations/account/create_account_type";
import {
  DeleteAccountInputType,
  DeleteAccountPayloadType,
} from "src/graphql/generated/mutations/account/delete_account_type";
import {
  EditAccountInputType,
  EditAccountPayloadType,
} from "src/graphql/generated/mutations/account/edit_account_type";
import {
  TodoStatusAccountEditInputType,
  TodoStatusAccountEditPayloadType,
} from "src/graphql/generated/mutations/account/todo_status_account_edit_type";
import { AccountPrefsInputType } from "src/graphql/generated/mutations/input/account_prefs_input_type";
import { AccountTodoStatusInputType } from "src/graphql/generated/mutations/input_enums_type";
import { MutationType } from "src/graphql/generated/mutations/mutation_type";
import {
  CreateTagInputType,
  CreateTagPayloadType,
} from "src/graphql/generated/mutations/tag/create_tag_type";
import {
  AddTodoTagInputType,
  AddTodoTagPayloadType,
} from "src/graphql/generated/mutations/todo/add_todo_tag_type";
import {
  ChangeTodoBountyInputType,
  ChangeTodoBountyPayloadType,
} from "src/graphql/generated/mutations/todo/change_todo_bounty_type";
import {
  ChangeTodoStatusInputType,
  ChangeTodoStatusPayloadType,
} from "src/graphql/generated/mutations/todo/change_todo_status_type";
import {
  CreateTodoInputType,
  CreateTodoPayloadType,
} from "src/graphql/generated/mutations/todo/create_todo_type";
import {
  DeleteTodoInputType,
  DeleteTodoPayloadType,
} from "src/graphql/generated/mutations/todo/delete_todo_type";
import {
  RemoveTodoTagInputType,
  RemoveTodoTagPayloadType,
} from "src/graphql/generated/mutations/todo/remove_todo_tag_type";
import {
  RenameTodoInputType,
  RenameTodoPayloadType,
} from "src/graphql/generated/mutations/todo/rename_todo_type";
import {
  CreateWorkspaceInputType,
  CreateWorkspacePayloadType,
} from "src/graphql/generated/mutations/workspace/create_workspace_type";
import {
  DeleteWorkspaceInputType,
  DeleteWorkspacePayloadType,
} from "src/graphql/generated/mutations/workspace/delete_workspace_type";
import {
  EditWorkspaceInputType,
  EditWorkspacePayloadType,
} from "src/graphql/generated/mutations/workspace/edit_workspace_type";
import { QueryType } from "src/graphql/generated/resolvers/query_type";
import {
  AccountCanViewerSeeType,
  AccountPrefsType,
  AccountToClosedTodosDupConnectionType,
  AccountToCreatedWorkspacesConnectionType,
  AccountToOpenTodosConnectionType,
  AccountToOpenTodosDupConnectionType,
  AccountToScopedTodosConnectionType,
  AccountToTagsConnectionType,
  AccountToTodosConnectionType,
  AccountToWorkspacesConnectionType,
  AccountTodoStatusType,
  AccountType,
  AssigneeToTodosConnectionType,
  RootToClosedTodosLastDayConnectionType,
  RootToOpenTodosConnectionType,
  TagToTodosConnectionType,
  TagType,
  TodoToTagsConnectionType,
  TodoToTodoScopeConnectionType,
  TodoType,
  WorkspaceToMembersConnectionType,
  WorkspaceToScopedTodosConnectionType,
  WorkspaceType,
} from "src/graphql/resolvers";

export default new GraphQLSchema({
  query: QueryType,
  mutation: MutationType,
  types: [
    AccountTodoStatusType,
    AccountCanViewerSeeType,
    AccountPrefsType,
    AccountType,
    TagType,
    TodoType,
    WorkspaceType,
    AccountToClosedTodosDupConnectionType(),
    AccountToCreatedWorkspacesConnectionType(),
    AccountToOpenTodosConnectionType(),
    AccountToOpenTodosDupConnectionType(),
    AccountToScopedTodosConnectionType(),
    AccountToTagsConnectionType(),
    AccountToTodosConnectionType(),
    AccountToWorkspacesConnectionType(),
    AssigneeToTodosConnectionType(),
    RootToClosedTodosLastDayConnectionType(),
    RootToOpenTodosConnectionType(),
    TagToTodosConnectionType(),
    TodoToTagsConnectionType(),
    TodoToTodoScopeConnectionType(),
    WorkspaceToMembersConnectionType(),
    WorkspaceToScopedTodosConnectionType(),
    AccountPrefsInputType,
    AccountTodoStatusInputType,
    AccountTransferCreditsInputType,
    AccountTransferCreditsPayloadType,
    AccountUpdateBalanceInputType,
    AccountUpdateBalancePayloadType,
    AddTodoTagInputType,
    AddTodoTagPayloadType,
    ChangeTodoBountyInputType,
    ChangeTodoBountyPayloadType,
    ChangeTodoStatusInputType,
    ChangeTodoStatusPayloadType,
    CreateAccountInputType,
    CreateAccountPayloadType,
    CreateTagInputType,
    CreateTagPayloadType,
    CreateTodoInputType,
    CreateTodoPayloadType,
    CreateWorkspaceInputType,
    CreateWorkspacePayloadType,
    DeleteAccountInputType,
    DeleteAccountPayloadType,
    DeleteTodoInputType,
    DeleteTodoPayloadType,
    DeleteWorkspaceInputType,
    DeleteWorkspacePayloadType,
    EditAccountInputType,
    EditAccountPayloadType,
    EditWorkspaceInputType,
    EditWorkspacePayloadType,
    RemoveTodoTagInputType,
    RemoveTodoTagPayloadType,
    RenameTodoInputType,
    RenameTodoPayloadType,
    TodoStatusAccountEditInputType,
    TodoStatusAccountEditPayloadType,
  ],
});
