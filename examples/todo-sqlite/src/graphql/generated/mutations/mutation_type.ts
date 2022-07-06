// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { GraphQLObjectType } from "graphql";
import { CreateAccountType } from "src/graphql/generated/mutations/account/create_account_type";
import { DeleteAccountType } from "src/graphql/generated/mutations/account/delete_account_type";
import { EditAccountType } from "src/graphql/generated/mutations/account/edit_account_type";
import { MarkAllTodosAsType } from "src/graphql/generated/mutations/mark_all_todos_as_type";
import { RemoveCompletedTodosType } from "src/graphql/generated/mutations/remove_completed_todos_type";
import { CreateTagType } from "src/graphql/generated/mutations/tag/create_tag_type";
import { AddTodoTagType } from "src/graphql/generated/mutations/todo/add_todo_tag_type";
import { ChangeTodoStatusType } from "src/graphql/generated/mutations/todo/change_todo_status_type";
import { CreateTodoType } from "src/graphql/generated/mutations/todo/create_todo_type";
import { DeleteTodoType } from "src/graphql/generated/mutations/todo/delete_todo_type";
import { RemoveTodoTagType } from "src/graphql/generated/mutations/todo/remove_todo_tag_type";
import { RenameTodoType } from "src/graphql/generated/mutations/todo/rename_todo_type";

export const MutationType = new GraphQLObjectType({
  name: "Mutation",
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