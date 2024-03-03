import { gqlField, gqlObjectType } from "@snowtop/ent/graphql";
import { Viewer } from "@snowtop/ent";
import { Guest, User } from "src/ent/";

// TODO we should expecially throw for "Viewer"
@gqlObjectType({ name: "Viewer" })
export class GraphQLViewer {
  constructor(private viewer: Viewer) {}

  @gqlField({
    class: "GraphQLViewer",
    type: User,
    nullable: true,
    async: true,
  })
  async user(): Promise<User | null> {
    const v = this.viewer.viewerID;
    if (!v) {
      return null;
    }
    return User.load(this.viewer, v);
  }

  @gqlField({
    class: "GraphQLViewer",
    type: Guest,
    nullable: true,
    async: true,
  })
  async guest(): Promise<Guest | null> {
    const v = this.viewer.viewerID;
    if (!v) {
      return null;
    }
    return Guest.load(this.viewer, v);
  }
}
