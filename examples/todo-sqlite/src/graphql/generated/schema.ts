// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { GraphQLSchema } from "graphql";
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
  AccountTodoStatusInputType,
  TodoStatusAccountEditInputType,
  TodoStatusAccountEditPayloadType,
} from "src/graphql/generated/mutations/account/todo_status_account_edit_type";
import { AccountPrefsInputType } from "src/graphql/generated/mutations/input/account_prefs_input_type";
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
    RootToClosedTodosLastDayConnectionType(),
    RootToOpenTodosConnectionType(),
    TagToTodosConnectionType(),
    TodoToTagsConnectionType(),
    TodoToTodoScopeConnectionType(),
    WorkspaceToMembersConnectionType(),
    WorkspaceToScopedTodosConnectionType(),
    AccountPrefsInputType,
    AccountTodoStatusInputType,
    AddTodoTagInputType,
    AddTodoTagPayloadType,
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
