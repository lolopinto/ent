// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { GraphQLObjectType } from "graphql";
import { AccountCreateType } from "src/graphql/mutations/generated/account/account_create_type";
import { AccountDeleteType } from "src/graphql/mutations/generated/account/account_delete_type";
import { AccountEditType } from "src/graphql/mutations/generated/account/account_edit_type";
import { TagCreateType } from "src/graphql/mutations/generated/tag/tag_create_type";
import { TodoAddTagType } from "src/graphql/mutations/generated/todo/todo_add_tag_type";
import { TodoChangeStatusType } from "src/graphql/mutations/generated/todo/todo_change_status_type";
import { TodoCreateType } from "src/graphql/mutations/generated/todo/todo_create_type";
import { TodoDeleteType } from "src/graphql/mutations/generated/todo/todo_delete_type";
import { TodoRemoveTagType } from "src/graphql/mutations/generated/todo/todo_remove_tag_type";
import { TodoRenameType } from "src/graphql/mutations/generated/todo/todo_rename_type";
import { TodosMarkAllAsType } from "src/graphql/mutations/generated/todos_mark_all_as_type";
import { TodosRemoveCompletedType } from "src/graphql/mutations/generated/todos_remove_completed_type";

export const MutationType = new GraphQLObjectType({
  name: "Mutation",
  fields: () => ({
    accountCreate: AccountCreateType,
    accountDelete: AccountDeleteType,
    accountEdit: AccountEditType,
    tagCreate: TagCreateType,
    todoAddTag: TodoAddTagType,
    todoChangeStatus: TodoChangeStatusType,
    todoCreate: TodoCreateType,
    todoDelete: TodoDeleteType,
    todoRemoveTag: TodoRemoveTagType,
    todoRename: TodoRenameType,
    todosMarkAllAs: TodosMarkAllAsType,
    todosRemoveCompleted: TodosRemoveCompletedType,
  }),
});
