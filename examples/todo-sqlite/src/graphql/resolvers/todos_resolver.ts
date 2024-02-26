import {
  ID,
  IDViewer,
  query,
  RequestContext,
  CustomClauseQuery,
  CustomEdgeQueryBase,
  Viewer,
  Clause,
} from "@snowtop/ent";
import { gqlConnection, gqlContextType, gqlQuery } from "@snowtop/ent/graphql";
import { GraphQLID } from "graphql";
import { Account, Todo } from "src/ent";
import { Interval } from "luxon";

// duplicated from account.ts because running into loading issues here...
// with it being there and importing it
export class AccountToOpenTodosQuery2 extends CustomEdgeQueryBase<
  Account,
  Todo
> {
  constructor(viewer: Viewer, src: ID | Account) {
    super(viewer, {
      src,
      groupCol: "assignee_id",
      loadEntOptions: Todo.loaderOptions(),
      clause: query.Eq("completed", false),
      name: "account_to_open_todos",
      orderby: [
        {
          column: "created_at",
          direction: "DESC",
        },
      ],
    });
  }
  sourceEnt(id: ID) {
    return Account.load(this.viewer, id);
  }
}

export class TodoResolver {
  // showing plural
  @gqlQuery({
    class: "TodoResolver",
    name: "open_todos_plural",
    type: "[Todo]",
    args: [
      {
        name: "id",
        type: GraphQLID,
      },
    ],
    async: true,
  })
  async openTodosPlural(id: ID): Promise<Todo[]> {
    const viewer = new IDViewer(id);
    return Todo.loadCustom(
      viewer,
      query.And(query.Eq("assignee_id", id), query.Eq("completed", false)),
    );
  }

  // showing connection
  @gqlQuery({
    class: "TodoResolver",
    name: "open_todos",
    type: gqlConnection("Todo"),
    args: [
      gqlContextType(),
      {
        name: "id",
        type: GraphQLID,
      },
    ],
  })
  openTodos(
    // we're not using context but have it here to show that it works
    _context: RequestContext,
    id: ID,
  ) {
    const viewer = new IDViewer(id);
    return new AccountToOpenTodosQuery2(viewer, id);
  }

  @gqlQuery({
    class: "TodoResolver",
    name: "closed_todos_last_day",
    type: gqlConnection("Todo"),
    args: [gqlContextType()],
  })
  closedTodosLastDay(context: RequestContext) {
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

  @gqlQuery({
    class: "TodoResolver",
    name: "custom_todos",
    type: gqlConnection("Todo"),
    args: [
      gqlContextType(),
      {
        name: "completed",
        type: "Boolean",
        nullable: true,
      },
      {
        name: "completed_date",
        type: "Date",
        nullable: true,
      },
    ],
  })
  customTodos(
    context: RequestContext,
    completed: boolean | null,
    completedDate: Date | null,
  ) {
    let completedQ = completed ?? true;
    let clause: Clause;

    if (completed && completedDate) {
      clause = query.And(
        query.Eq("completed", completedQ),
        query.GreaterEq("completed_date", completedDate),
      );
    } else {
      clause = query.Eq("completed", completedQ);
    }

    return new CustomClauseQuery(context.getViewer(), {
      loadEntOptions: Todo.loaderOptions(),
      clause: clause,
      name: "custom_todos",
    });
  }
}
