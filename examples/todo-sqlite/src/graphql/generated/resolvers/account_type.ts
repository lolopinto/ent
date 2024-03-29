// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLBoolean,
  GraphQLFieldConfigMap,
  GraphQLID,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from "graphql";
import { RequestContext, Viewer } from "@snowtop/ent";
import {
  GraphQLEdgeConnection,
  GraphQLNodeInterface,
  GraphQLTime,
} from "@snowtop/ent/graphql";
import {
  Account,
  AccountCanViewerSee,
  AccountToClosedTodosDupQuery,
  AccountToCreatedWorkspacesQuery,
  AccountToOpenTodosDupQuery,
  AccountToScopedTodosQuery,
  AccountToTagsQuery,
  AccountToTodosQuery,
  AccountToWorkspacesQuery,
  AssigneeToTodosQuery,
  Todo,
} from "src/ent/";
import {
  AccountPrefsType,
  AccountToClosedTodosDupConnectionType,
  AccountToCreatedWorkspacesConnectionType,
  AccountToCustomTodosConnectionType,
  AccountToOpenTodosConnectionType,
  AccountToOpenTodosDupConnectionType,
  AccountToScopedTodosConnectionType,
  AccountToTagsConnectionType,
  AccountToTodosConnectionType,
  AccountToWorkspacesConnectionType,
  AccountTodoStatusType,
  AssigneeToTodosConnectionType,
  CountryInfoType,
  TodoType,
} from "src/graphql/resolvers/internal";

export const AccountType = new GraphQLObjectType({
  name: "Account",
  fields: (): GraphQLFieldConfigMap<Account, RequestContext<Viewer>> => ({
    id: {
      type: new GraphQLNonNull(GraphQLID),
    },
    name: {
      type: new GraphQLNonNull(GraphQLString),
    },
    phone_number: {
      type: GraphQLString,
      resolve: (obj: Account, args: {}, context: RequestContext<Viewer>) => {
        return obj.phoneNumber;
      },
    },
    account_prefs: {
      type: AccountPrefsType,
      resolve: (obj: Account, args: {}, context: RequestContext<Viewer>) => {
        return obj.accountPrefs;
      },
    },
    account_prefs3: {
      type: AccountPrefsType,
      resolve: (obj: Account, args: {}, context: RequestContext<Viewer>) => {
        return obj.accountPrefs3;
      },
    },
    account_prefs_list: {
      type: new GraphQLList(new GraphQLNonNull(AccountPrefsType)),
      resolve: (obj: Account, args: {}, context: RequestContext<Viewer>) => {
        return obj.accountPrefsList;
      },
    },
    credits: {
      type: GraphQLInt,
    },
    country_infos: {
      type: new GraphQLList(new GraphQLNonNull(CountryInfoType)),
      resolve: (obj: Account, args: {}, context: RequestContext<Viewer>) => {
        return obj.countryInfos;
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
      resolve: (obj: Account, args: any, context: RequestContext<Viewer>) => {
        return new GraphQLEdgeConnection(
          obj.viewer,
          obj,
          (v, obj: Account) => AccountToClosedTodosDupQuery.query(v, obj),
          args,
        );
      },
    },
    created_workspaces: {
      type: new GraphQLNonNull(AccountToCreatedWorkspacesConnectionType()),
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
      resolve: (obj: Account, args: any, context: RequestContext<Viewer>) => {
        return new GraphQLEdgeConnection(
          obj.viewer,
          obj,
          (v, obj: Account) => AccountToCreatedWorkspacesQuery.query(v, obj),
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
      resolve: (obj: Account, args: any, context: RequestContext<Viewer>) => {
        return new GraphQLEdgeConnection(
          obj.viewer,
          obj,
          (v, obj: Account) => AccountToOpenTodosDupQuery.query(v, obj),
          args,
        );
      },
    },
    scoped_todos: {
      type: new GraphQLNonNull(AccountToScopedTodosConnectionType()),
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
      resolve: (obj: Account, args: any, context: RequestContext<Viewer>) => {
        return new GraphQLEdgeConnection(
          obj.viewer,
          obj,
          (v, obj: Account) => AccountToScopedTodosQuery.query(v, obj),
          args,
        );
      },
    },
    workspaces: {
      type: new GraphQLNonNull(AccountToWorkspacesConnectionType()),
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
      resolve: (obj: Account, args: any, context: RequestContext<Viewer>) => {
        return new GraphQLEdgeConnection(
          obj.viewer,
          obj,
          (v, obj: Account) => AccountToWorkspacesQuery.query(v, obj),
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
      resolve: (obj: Account, args: any, context: RequestContext<Viewer>) => {
        return new GraphQLEdgeConnection(
          obj.viewer,
          obj,
          (v, obj: Account) => AccountToTagsQuery.query(v, obj),
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
      resolve: (obj: Account, args: any, context: RequestContext<Viewer>) => {
        return new GraphQLEdgeConnection(
          obj.viewer,
          obj,
          (v, obj: Account) => AccountToTodosQuery.query(v, obj),
          args,
        );
      },
    },
    todos_assigned: {
      type: new GraphQLNonNull(AssigneeToTodosConnectionType()),
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
      resolve: (obj: Account, args: any, context: RequestContext<Viewer>) => {
        return new GraphQLEdgeConnection(
          obj.viewer,
          obj,
          (v, obj: Account) => AssigneeToTodosQuery.query(v, obj),
          args,
        );
      },
    },
    todo_status_for: {
      type: AccountTodoStatusType,
      args: {
        id: {
          description: "",
          type: new GraphQLNonNull(GraphQLID),
        },
      },
      resolve: async (
        obj: Account,
        args: any,
        context: RequestContext<Viewer>,
      ) => {
        const ent = await Todo.loadX(context.getViewer(), args.id);
        return obj.todoStatusFor(ent);
      },
    },
    can_viewer_see_info: {
      type: new GraphQLNonNull(AccountCanViewerSeeType),
      resolve: (obj: Account, args: {}, context: RequestContext<Viewer>) => {
        return obj.canViewerSeeInfo();
      },
    },
    open_todos_plural: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(TodoType))),
      resolve: async (
        obj: Account,
        args: {},
        context: RequestContext<Viewer>,
      ) => {
        return obj.openTodosPlural();
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
      resolve: (obj: Account, args: any, context: RequestContext<Viewer>) => {
        return new GraphQLEdgeConnection(
          obj.viewer,
          obj,
          (v, obj: Account) => obj.openTodos(),
          args,
        );
      },
    },
    custom_todos: {
      type: new GraphQLNonNull(AccountToCustomTodosConnectionType()),
      args: {
        completed: {
          description: "",
          type: GraphQLBoolean,
        },
        completed_date: {
          description: "",
          type: GraphQLTime,
        },
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
      resolve: (obj: Account, args: any, context: RequestContext<Viewer>) => {
        return new GraphQLEdgeConnection(
          obj.viewer,
          obj,
          (v, obj: Account) =>
            obj.customTodos(args.completed, args.completed_date),
          args,
        );
      },
    },
  }),
  interfaces: () => [GraphQLNodeInterface],
  isTypeOf(obj) {
    return obj instanceof Account;
  },
});

export const AccountCanViewerSeeType = new GraphQLObjectType({
  name: "AccountCanViewerSee",
  fields: (): GraphQLFieldConfigMap<
    AccountCanViewerSee,
    RequestContext<Viewer>
  > => ({
    phone_number: {
      type: new GraphQLNonNull(GraphQLBoolean),
      resolve: async (
        obj: AccountCanViewerSee,
        args: {},
        context: RequestContext<Viewer>,
      ) => {
        return obj.phoneNumber();
      },
    },
    account_prefs3: {
      type: new GraphQLNonNull(GraphQLBoolean),
      resolve: async (
        obj: AccountCanViewerSee,
        args: {},
        context: RequestContext<Viewer>,
      ) => {
        return obj.accountPrefs3();
      },
    },
    credits: {
      type: new GraphQLNonNull(GraphQLBoolean),
      resolve: async (
        obj: AccountCanViewerSee,
        args: {},
        context: RequestContext<Viewer>,
      ) => {
        return obj.credits();
      },
    },
  }),
});
