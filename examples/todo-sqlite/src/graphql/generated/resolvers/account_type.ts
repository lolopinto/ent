// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLFieldConfigMap,
  GraphQLID,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from "graphql";
import { RequestContext } from "@snowtop/ent";
import {
  GraphQLEdgeConnection,
  GraphQLNodeInterface,
} from "@snowtop/ent/graphql";
import { Account, AccountToTagsQuery, AccountToTodosQuery } from "src/ent/";
import {
  AccountStateType,
  AccountToOpenTodosConnectionType,
  AccountToTagsConnectionType,
  AccountToTodosConnectionType,
  TodoType,
} from "src/graphql/resolvers/internal";

export const AccountType = new GraphQLObjectType({
  name: "Account",
  fields: (): GraphQLFieldConfigMap<Account, RequestContext> => ({
    id: {
      type: new GraphQLNonNull(GraphQLID),
    },
    name: {
      type: new GraphQLNonNull(GraphQLString),
    },
    phone_number: {
      type: GraphQLString,
      resolve: (account: Account, args: {}, context: RequestContext) => {
        return account.phoneNumber;
      },
    },
    account_state: {
      type: AccountStateType,
      resolve: (account: Account, args: {}, context: RequestContext) => {
        return account.accountState;
      },
    },
    tags: {
      type: new GraphQLNonNull(AccountToTagsConnectionType()),
      args: {
        first: {
          description: "",
          type: GraphQLInt,
        },
        after: {
          description: "",
          type: GraphQLString,
        },
        last: {
          description: "",
          type: GraphQLInt,
        },
        before: {
          description: "",
          type: GraphQLString,
        },
      },
      resolve: (account: Account, args: {}, context: RequestContext) => {
        return new GraphQLEdgeConnection(
          account.viewer,
          account,
          (v, account: Account) => AccountToTagsQuery.query(v, account),
          args,
        );
      },
    },
    todos: {
      type: new GraphQLNonNull(AccountToTodosConnectionType()),
      args: {
        first: {
          description: "",
          type: GraphQLInt,
        },
        after: {
          description: "",
          type: GraphQLString,
        },
        last: {
          description: "",
          type: GraphQLInt,
        },
        before: {
          description: "",
          type: GraphQLString,
        },
      },
      resolve: (account: Account, args: {}, context: RequestContext) => {
        return new GraphQLEdgeConnection(
          account.viewer,
          account,
          (v, account: Account) => AccountToTodosQuery.query(v, account),
          args,
        );
      },
    },
    open_todos_plural: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(TodoType))),
      resolve: async (account: Account, args: {}, context: RequestContext) => {
        return account.openTodosPlural();
      },
    },
    open_todos: {
      type: new GraphQLNonNull(AccountToOpenTodosConnectionType()),
      args: {
        first: {
          description: "",
          type: GraphQLInt,
        },
        after: {
          description: "",
          type: GraphQLString,
        },
        last: {
          description: "",
          type: GraphQLInt,
        },
        before: {
          description: "",
          type: GraphQLString,
        },
      },
      resolve: (account: Account, args: {}, context: RequestContext) => {
        return new GraphQLEdgeConnection(
          account.viewer,
          account,
          (v, account: Account) => account.openTodos(),
          args,
        );
      },
    },
  }),
  interfaces: [GraphQLNodeInterface],
  isTypeOf(obj) {
    return obj instanceof Account;
  },
});