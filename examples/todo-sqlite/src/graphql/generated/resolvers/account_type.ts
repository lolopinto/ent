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
import {
  Account,
  AccountToClosedTodosDupQuery,
  AccountToOpenTodosDupQuery,
  AccountToTagsQuery,
  AccountToTodosQuery,
  Todo,
} from "src/ent/";
import {
  AccountToClosedTodosDupConnectionType,
  AccountToOpenTodosConnectionType,
  AccountToOpenTodosDupConnectionType,
  AccountToTagsConnectionType,
  AccountToTodosConnectionType,
  AccountTodoStatusType,
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
    closed_todos_dup: {
      type: new GraphQLNonNull(AccountToClosedTodosDupConnectionType()),
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
      resolve: (account: Account, args: any, context: RequestContext) => {
        return new GraphQLEdgeConnection(
          account.viewer,
          account,
          (v, account: Account) =>
            AccountToClosedTodosDupQuery.query(v, account),
          args,
        );
      },
    },
    open_todos_dup: {
      type: new GraphQLNonNull(AccountToOpenTodosDupConnectionType()),
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
      resolve: (account: Account, args: any, context: RequestContext) => {
        return new GraphQLEdgeConnection(
          account.viewer,
          account,
          (v, account: Account) => AccountToOpenTodosDupQuery.query(v, account),
          args,
        );
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
      resolve: (account: Account, args: any, context: RequestContext) => {
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
      resolve: (account: Account, args: any, context: RequestContext) => {
        return new GraphQLEdgeConnection(
          account.viewer,
          account,
          (v, account: Account) => AccountToTodosQuery.query(v, account),
          args,
        );
      },
    },
    todoStatusFor: {
      type: AccountTodoStatusType,
      args: {
        id: {
          description: "",
          type: new GraphQLNonNull(GraphQLID),
        },
      },
      resolve: async (account: Account, args: any, context: RequestContext) => {
        const ent = await Todo.loadX(context.getViewer(), args.id);
        return account.todoStatusFor(ent);
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
      resolve: (account: Account, args: any, context: RequestContext) => {
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
