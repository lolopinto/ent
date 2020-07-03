import {
  gqlInputObjectType,
  gqlField,
  gqlObjectType,
  gqlContextType,
  gqlQuery,
} from "ent/graphql";
import { Viewer } from "ent/ent";
import { GraphQLID } from "graphql";
import { Context } from "ent/auth/context";
import User from "src/ent/user";

@gqlObjectType({ name: "Viewer" })
// TODO when this wasn't exported, it didn't break...
export class ViewerType {
  constructor(private viewer: Viewer) {}

  @gqlField({ type: GraphQLID, nullable: true })
  get viewerID() {
    return this.viewer.viewerID;
  }
}

export default class ViewerResolver {
  @gqlQuery({ name: "viewer", type: ViewerType })
  viewer(@gqlContextType() context: Context): ViewerType {
    return new ViewerType(context.getViewer());
  }
}
