// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { GraphQLObjectType } from "graphql";
import { CreateAccountType } from "src/graphql/mutations/generated/account/create_account_type";
import { DeleteAccountType } from "src/graphql/mutations/generated/account/delete_account_type";
import { EditAccountType } from "src/graphql/mutations/generated/account/edit_account_type";
import { MarkAllTodosAsType } from "src/graphql/mutations/generated/mark_all_todos_as_type";
import { RemoveCompletedTodosType } from "src/graphql/mutations/generated/remove_completed_todos_type";
import { CreateTagType } from "src/graphql/mutations/generated/tag/create_tag_type";
import { AddTodoTagType } from "src/graphql/mutations/generated/todo/add_todo_tag_type";
import { ChangeTodoStatusType } from "src/graphql/mutations/generated/todo/change_todo_status_type";
import { CreateTodoType } from "src/graphql/mutations/generated/todo/create_todo_type";
import { DeleteTodoType } from "src/graphql/mutations/generated/todo/delete_todo_type";
import { RemoveTodoTagType } from "src/graphql/mutations/generated/todo/remove_todo_tag_type";
import { RenameTodoType } from "src/graphql/mutations/generated/todo/rename_todo_type";

export const MutationType = new GraphQLObjectType({
  name: "Mutation",
  // @ts-ignore graphql-js TS #2152 2829
  fields: () => ({
    addTodoTag: AddTodoTagType,
    changeTodoStatus: ChangeTodoStatusType,
    createAccount: CreateAccountType,
    createTag: CreateTagType,
    createTodo: CreateTodoType,
    deleteAccount: DeleteAccountType,
    deleteTodo: DeleteTodoType,
    editAccount: EditAccountType,
    markAllTodosAs: MarkAllTodosAsType,
    removeCompletedTodos: RemoveCompletedTodosType,
    removeTodoTag: RemoveTodoTagType,
    renameTodo: RenameTodoType,
  }),
});
