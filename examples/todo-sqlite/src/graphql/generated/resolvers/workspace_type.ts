// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLFieldConfigMap,
  GraphQLID,
  GraphQLInt,
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
  Workspace,
  WorkspaceToMembersQuery,
  WorkspaceToScopedTodosQuery,
} from "src/ent/";
import {
  AccountType,
  WorkspaceToMembersConnectionType,
  WorkspaceToScopedTodosConnectionType,
} from "src/graphql/resolvers/internal";

export const WorkspaceType = new GraphQLObjectType({
  name: "Workspace",
  fields: (): GraphQLFieldConfigMap<Workspace, RequestContext> => ({
    creator: {
      type: AccountType,
      resolve: (workspace: Workspace, args: {}, context: RequestContext) => {
        return workspace.loadCreator();
      },
    },
    id: {
      type: new GraphQLNonNull(GraphQLID),
    },
    name: {
      type: new GraphQLNonNull(GraphQLString),
    },
    slug: {
      type: new GraphQLNonNull(GraphQLString),
    },
    members: {
      type: new GraphQLNonNull(WorkspaceToMembersConnectionType()),
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
      resolve: (workspace: Workspace, args: any, context: RequestContext) => {
        return new GraphQLEdgeConnection(
          workspace.viewer,
          workspace,
          (v, workspace: Workspace) =>
            WorkspaceToMembersQuery.query(v, workspace),
          args,
        );
      },
    },
    scoped_todos: {
      type: new GraphQLNonNull(WorkspaceToScopedTodosConnectionType()),
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
      resolve: (workspace: Workspace, args: any, context: RequestContext) => {
        return new GraphQLEdgeConnection(
          workspace.viewer,
          workspace,
          (v, workspace: Workspace) =>
            WorkspaceToScopedTodosQuery.query(v, workspace),
          args,
        );
      },
    },
  }),
  interfaces: [GraphQLNodeInterface],
  isTypeOf(obj) {
    return obj instanceof Workspace;
  },
});
