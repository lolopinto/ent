import {
  gqlField,
  gqlObjectType,
  gqlContextType,
  gqlQuery,
  encodeGQLID,
} from "@snowtop/ent/graphql";
import { GraphQLID } from "graphql";
import { Viewer, RequestContext } from "@snowtop/ent";

import { User } from "../../ent";

@gqlObjectType({ name: "Viewer" })
// TODO when this wasn't exported, it didn't work...
// TODO when this is named ViewerType, it breaks
export class GQLViewer {
  constructor(private viewer: Viewer) {}

  @gqlField({ type: GraphQLID, nullable: true })
  async viewerID() {
    const user = await this.user();
    if (!user) {
      return null;
    }
    return encodeGQLID(user);
  }

  @gqlField({ type: User, nullable: true })
  async user(): Promise<User | null> {
    const v = this.viewer.viewerID;
    if (!v) {
      return null;
    }
    return User.loadX(this.viewer, v);
  }
}

export default class ViewerResolver {
  @gqlQuery({ name: "viewer", type: GQLViewer })
  viewer(@gqlContextType() context: RequestContext): GQLViewer {
    return new GQLViewer(context.getViewer());
  }
}
