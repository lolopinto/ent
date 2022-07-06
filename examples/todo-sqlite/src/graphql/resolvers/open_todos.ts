import {
  getTransformedReadClause,
  ID,
  IDViewer,
  query,
  RequestContext,
} from "@snowtop/ent";
import {
  gqlArg,
  gqlConnection,
  gqlContextType,
  gqlQuery,
} from "@snowtop/ent/graphql";
import { GraphQLID } from "graphql";
import { Todo, AccountToOpenTodosQuery } from "src/ent";
import TodoSchema from "src/schema/todo_schema";

export class TodoResolver {
  // showing plural
  @gqlQuery({ name: "open_todos_plural", type: "[Todo]" })
  async openTodosPlural(
    @gqlArg("id", { type: GraphQLID }) id: ID,
  ): Promise<Todo[]> {
    const viewer = new IDViewer(id);
    return await Todo.loadCustom(
      viewer,
      query.AndOptional(
        query.Eq("creator_id", id),
        query.Eq("completed", false),
        getTransformedReadClause(TodoSchema),
      ),
    );
  }

  // showing connection
  @gqlQuery({ name: "open_todos", type: gqlConnection("Todo") })
  openTodos(
    // we're not using context but have it here to show that it works
    @gqlContextType() _context: RequestContext,
    @gqlArg("id", { type: GraphQLID }) id: ID,
  ) {
    const viewer = new IDViewer(id);
    return new AccountToOpenTodosQuery(viewer, id);
  }
}
