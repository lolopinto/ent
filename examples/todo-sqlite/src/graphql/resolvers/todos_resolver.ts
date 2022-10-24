import {
  ID,
  IDViewer,
  query,
  RequestContext,
  CustomClauseQuery,
} from "@snowtop/ent";
import {
  gqlArg,
  gqlConnection,
  gqlContextType,
  gqlQuery,
} from "@snowtop/ent/graphql";
import { GraphQLID } from "graphql";
import { Todo, AccountToOpenTodosQuery } from "src/ent";
import { Interval } from "luxon";

export class TodoResolver {
  // showing plural
  @gqlQuery({ name: "open_todos_plural", type: "[Todo]" })
  async openTodosPlural(
    @gqlArg("id", { type: GraphQLID }) id: ID,
  ): Promise<Todo[]> {
    const viewer = new IDViewer(id);
    return await Todo.loadCustom(
      viewer,
      query.And(query.Eq("assignee_id", id), query.Eq("completed", false)),
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

  @gqlQuery({ name: "closed_todos_last_day", type: gqlConnection("Todo") })
  closedTodosLastDay(@gqlContextType() context: RequestContext) {
    const start = Interval.before(new Date(), { hours: 24 })
      .start.toUTC()
      .toISO();

    return new CustomClauseQuery(context.getViewer(), {
      loadEntOptions: Todo.loaderOptions(),
      clause: query.And(
        query.Eq("completed", true),
        query.GreaterEq("completed_date", start),
      ),
      name: "closed_todos_last_day",
    });
  }
}
