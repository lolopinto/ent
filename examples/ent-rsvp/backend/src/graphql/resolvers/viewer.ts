import { gqlContextType, gqlQuery } from "@snowtop/ent/graphql";
import { RequestContext } from "@snowtop/ent";
import { GraphQLViewer } from "./viewer_type";

export default class ViewerResolver {
  @gqlQuery({
    class: "ViewerResolver",
    name: "viewer",
    type: GraphQLViewer,
    nullable: true,
    args: [gqlContextType()],
  })
  viewer(context: RequestContext): GraphQLViewer {
    return new GraphQLViewer(context.getViewer());
  }
}
