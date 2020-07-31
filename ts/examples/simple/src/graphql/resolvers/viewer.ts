import {
  gqlField,
  gqlObjectType,
  gqlContextType,
  gqlQuery,
} from "@lolopinto/ent/graphql";
import { GraphQLID } from "graphql";
import { Viewer, RequestContext } from "@lolopinto/ent";

import User from "src/ent/user";

@gqlObjectType({ name: "Viewer" })
// TODO when this wasn't exported, it didn't work...
// TODO when this is named ViewerType, it breaks
export class GQLViewer {
  constructor(private viewer: Viewer) {}

  @gqlField({ type: GraphQLID, nullable: true })
  get viewerID() {
    return this.viewer.viewerID;
  }

  @gqlField({ type: User, nullable: true })
  async user(): Promise<User | null> {
    if (!this.viewerID) {
      return null;
    }
    return User.loadX(this.viewer, this.viewerID);
  }
}

export default class ViewerResolver {
  @gqlQuery({ name: "viewer", type: GQLViewer })
  viewer(@gqlContextType() context: RequestContext): GQLViewer {
    return new GQLViewer(context.getViewer());
  }
}
