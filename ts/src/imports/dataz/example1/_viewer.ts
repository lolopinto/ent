import {
  gqlInputObjectType,
  gqlField,
  gqlObjectType,
  gqlContextType,
  gqlQuery,
} from "../../../graphql/graphql";
import { Viewer } from "../../../core/base";
import { GraphQLID } from "graphql";
import { RequestContext } from "../../../core/context";

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
