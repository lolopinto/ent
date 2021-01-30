import {
  gqlField,
  gqlObjectType,
  gqlContextType,
  gqlQuery,
} from "@lolopinto/ent/graphql";
import { Viewer, RequestContext } from "@lolopinto/ent";

import { Guest, User } from "src/ent/";

@gqlObjectType({ name: "Viewer" })

// TODO when this wasn't exported, it didn't work...
// TODO when this is named ViewerType, it breaks
export class GQLViewer {
  constructor(private viewer: Viewer) {}

  @gqlField({ type: User, nullable: true })
  async user(): Promise<User | null> {
    const v = this.viewer.viewerID;
    if (!v) {
      return null;
    }
    return User.load(this.viewer, v);
  }

  @gqlField({ type: Guest, nullable: true })
  async guest(): Promise<Guest | null> {
    const v = this.viewer.viewerID;
    if (!v) {
      return null;
    }
    return Guest.load(this.viewer, v);
  }
}

export default class ViewerResolver {
  @gqlQuery({ name: "viewer", type: GQLViewer, nullable: true })
  viewer(@gqlContextType() context: RequestContext): GQLViewer {
    return new GQLViewer(context.getViewer());
  }
}
