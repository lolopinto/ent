// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { GraphQLSchema } from "graphql";
import {
  AccountCreateInputType,
  AccountCreatePayloadType,
} from "src/graphql/mutations/generated/account/account_create_type";
import {
  AccountDeleteInputType,
  AccountDeletePayloadType,
} from "src/graphql/mutations/generated/account/account_delete_type";
import {
  AccountEditInputType,
  AccountEditPayloadType,
} from "src/graphql/mutations/generated/account/account_edit_type";
import { MutationType } from "src/graphql/mutations/generated/mutation_type";
import { QueryType } from "src/graphql/resolvers/generated/query_type";
import {
  AccountToTodosConnectionType,
  AccountType,
  TodoType,
} from "./resolvers";

export default new GraphQLSchema({
  query: QueryType,
  mutation: MutationType,
  types: [
    AccountType,
    TodoType,
    AccountToTodosConnectionType(),
    AccountCreateInputType,
    AccountCreatePayloadType,
    AccountDeleteInputType,
    AccountDeletePayloadType,
    AccountEditInputType,
    AccountEditPayloadType,
  ],
});
