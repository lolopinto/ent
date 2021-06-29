import { ID, IDViewer, query } from "@snowtop/snowtop-ts";
import { gqlArg, gqlQuery } from "@snowtop/snowtop-ts/graphql";
import { GraphQLID } from "graphql";
import { Todo } from "src/ent";

export class TodoResolver {
  // TODO this should eventually be a connection but we're starting here.
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
}
