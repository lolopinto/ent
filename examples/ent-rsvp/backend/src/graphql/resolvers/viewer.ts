import { gqlContextType, gqlQuery } from "@snowtop/ent/graphql";
import { RequestContext } from "@snowtop/ent";
import { ViewerType } from "./viewer_type";

export default class ViewerResolver {
  @gqlQuery({
    class: "ViewerResolver",
    name: "viewer",
    type: ViewerType,
    nullable: true,
    args: [gqlContextType()],
  })
  viewer(context: RequestContext): ViewerType {
    return new ViewerType(context.getViewer());
  }
}
