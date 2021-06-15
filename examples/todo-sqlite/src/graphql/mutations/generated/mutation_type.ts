// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { GraphQLObjectType } from "graphql";
import { AccountCreateType } from "src/graphql/mutations/generated/account/account_create_type";
import { AccountDeleteType } from "src/graphql/mutations/generated/account/account_delete_type";
import { AccountEditType } from "src/graphql/mutations/generated/account/account_edit_type";
import { TodoChangeStatusType } from "src/graphql/mutations/generated/todo/todo_change_status_type";
import { TodoCreateType } from "src/graphql/mutations/generated/todo/todo_create_type";
import { TodoDeleteType } from "src/graphql/mutations/generated/todo/todo_delete_type";
import { TodoRenameType } from "src/graphql/mutations/generated/todo/todo_rename_type";

export const MutationType = new GraphQLObjectType({
  name: "Mutation",
  fields: () => ({
    accountCreate: AccountCreateType,
    accountDelete: AccountDeleteType,
    accountEdit: AccountEditType,
    todoChangeStatus: TodoChangeStatusType,
    todoCreate: TodoCreateType,
    todoDelete: TodoDeleteType,
    todoRename: TodoRenameType,
  }),
});
