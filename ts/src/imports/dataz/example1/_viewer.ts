import {
  gqlInputObjectType,
  gqlField,
  gqlObjectType,
  gqlContextType,
  gqlQuery,
} from "../../../graphql";
import { Viewer } from "../../../ent";
import { GraphQLID } from "graphql";
import { RequestContext } from "../../../auth/context";

@gqlObjectType({ name: "Viewer" })
class ViewerType {
  constructor(private viewer: Viewer) {}

  @gqlField({ type: GraphQLID, nullable: true })
  get viewerID() {
    return this.viewer.viewerID;
  }
}

export default class ViewerResolver {
  @gqlQuery({ name: "viewer", type: ViewerType })
  viewer(@gqlContextType() context: RequestContext): ViewerType {
    return new ViewerType(context.getViewer());
  }
}
