import { ID, IDViewer, query, RequestContext } from "@snowtop/snowtop-ts";
import {
  gqlArg,
  gqlConnection,
  gqlContextType,
  gqlQuery,
  GraphQLEdgeConnection,
} from "@snowtop/snowtop-ts/graphql";
import { GraphQLID } from "graphql";
import { Todo, Account, AccountToOpenTodosQuery } from "src/ent";

export class TodoResolver {
  // showing plural
  @gqlQuery({ name: "openTodosLegacy", type: "[Todo]" })
  async openTodosLegacy(
    @gqlArg("id", { type: GraphQLID }) id: ID,
  ): Promise<Todo[]> {
    const viewer = new IDViewer(id);
    return await Todo.loadCustom(
      viewer,
      query.And(query.Eq("creator_id", id), query.Eq("completed", false)),
    );
  }

  // showing connection
  @gqlQuery({ type: gqlConnection("Todo") })
  async openTodos(
    // we're not using context but have it here just in case.
    @gqlContextType() _context: RequestContext,
    @gqlArg("id", { type: GraphQLID }) id: ID,
  ) {
    const viewer = new IDViewer(id);
    //    return new AccountToOpenTodosQuery(viewer, id);
    const account = await Account.loadX(viewer, id);
    return new GraphQLEdgeConnection(
      viewer,
      account,
      () => new AccountToOpenTodosQuery(viewer, id),
      // lesigh
      // missing args... if we do it this way
      // or...
      // so issue is either we have args or we don't have source
      // and have to make async work by updating graphqledgeconnection
    );
  }
}
