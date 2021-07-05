import {
  gqlField,
  gqlObjectType,
  gqlContextType,
  gqlQuery,
} from "@snowtop/ent/graphql";
import { Viewer, RequestContext } from "@snowtop/ent";

import { Guest, User } from "src/ent/";

@gqlObjectType({ name: "Viewer" })

// TODO when this wasn't exported, it didn't work...
export class ViewerType {
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
  @gqlQuery({ name: "viewer", type: ViewerType, nullable: true })
  viewer(@gqlContextType() context: RequestContext): ViewerType {
    return new ViewerType(context.getViewer());
  }
}
