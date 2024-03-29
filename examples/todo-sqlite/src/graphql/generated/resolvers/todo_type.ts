// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLBoolean,
  GraphQLFieldConfigMap,
  GraphQLID,
  GraphQLInt,
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
import { Todo, TodoToTagsQuery, TodoToTodoScopeQuery } from "src/ent/";
import {
  AccountType,
  TodoToTagsConnectionType,
  TodoToTodoScopeConnectionType,
} from "src/graphql/resolvers/internal";

export const TodoType = new GraphQLObjectType({
  name: "Todo",
  fields: (): GraphQLFieldConfigMap<Todo, RequestContext<Viewer>> => ({
    assignee: {
      type: AccountType,
      resolve: (obj: Todo, args: {}, context: RequestContext<Viewer>) => {
        return obj.loadAssignee();
      },
    },
    creator: {
      type: AccountType,
      resolve: (obj: Todo, args: {}, context: RequestContext<Viewer>) => {
        return obj.loadCreator();
      },
    },
    scope: {
      type: GraphQLNodeInterface,
      resolve: (obj: Todo, args: {}, context: RequestContext<Viewer>) => {
        return obj.loadScope();
      },
    },
    id: {
      type: new GraphQLNonNull(GraphQLID),
    },
    text: {
      type: new GraphQLNonNull(GraphQLString),
    },
    completed: {
      type: new GraphQLNonNull(GraphQLBoolean),
    },
    completed_date: {
      type: GraphQLTime,
      resolve: (obj: Todo, args: {}, context: RequestContext<Viewer>) => {
        return obj.completedDate;
      },
    },
    bounty: {
      type: GraphQLInt,
    },
    tags: {
      type: new GraphQLNonNull(TodoToTagsConnectionType()),
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
      resolve: (obj: Todo, args: any, context: RequestContext<Viewer>) => {
        return new GraphQLEdgeConnection(
          obj.viewer,
          obj,
          (v, obj: Todo) => TodoToTagsQuery.query(v, obj),
          args,
        );
      },
    },
    todo_scope: {
      type: new GraphQLNonNull(TodoToTodoScopeConnectionType()),
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
      resolve: (obj: Todo, args: any, context: RequestContext<Viewer>) => {
        return new GraphQLEdgeConnection(
          obj.viewer,
          obj,
          (v, obj: Todo) => TodoToTodoScopeQuery.query(v, obj),
          args,
        );
      },
    },
  }),
  interfaces: () => [GraphQLNodeInterface],
  isTypeOf(obj) {
    return obj instanceof Todo;
  },
});
