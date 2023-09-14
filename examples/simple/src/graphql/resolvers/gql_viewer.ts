import { gqlField, gqlObjectType, encodeGQLID } from "@snowtop/ent/graphql";
import { GraphQLID } from "graphql";

import { User } from "../../ent";
import { ExampleViewer } from "../../viewer/viewer";
import { UserPrefsStruct, NotifType } from "src/ent/generated/types";

@gqlObjectType({ name: "Viewer" })
// TODO when this wasn't exported, it didn't work...
// TODO when this is named ViewerType, it breaks
export class GQLViewer {
  constructor(private viewer: ExampleViewer) {}

  @gqlField({
    class: "GQLViewer",
    type: GraphQLID,
    nullable: true,
    description: "the id of the viewer",
    async: true,
  })
  async viewerID() {
    const user = await this.user();
    if (!user) {
      return null;
    }
    return encodeGQLID(user);
  }

  @gqlField({
    class: "GQLViewer",
    type: User,
    nullable: true,
    async: true,
  })
  async user(): Promise<User | null> {
    const v = this.viewer.viewerID;
    if (!v) {
      return null;
    }
    return User.loadX(this.viewer, v);
  }

  @gqlField({
    class: "GQLViewer",
    type: "UserPrefsStruct",
  })
  defaultUserPrefs(): UserPrefsStruct {
    return {
      enableNotifs: true,
      notifTypes: [NotifType.MOBILE],
      finishedNux: false,
    };
  }
}
