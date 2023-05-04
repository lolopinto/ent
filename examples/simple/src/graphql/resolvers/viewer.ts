import {
  gqlField,
  gqlObjectType,
  gqlContextType,
  gqlQuery,
  encodeGQLID,
} from "@snowtop/ent/graphql";
import { GraphQLID, GraphQLString } from "graphql";
import { RequestContext } from "@snowtop/ent";

import { User } from "../../ent";
import { ExampleViewer } from "../../viewer/viewer";
import { DateTime } from "luxon";

@gqlObjectType({ name: "Viewer" })
// TODO when this wasn't exported, it didn't work...
// TODO when this is named ViewerType, it breaks
export class GQLViewer {
  constructor(private viewer: ExampleViewer) {}

  @gqlField({
    nodeName: "GQLViewer",
    type: GraphQLID,
    nullable: true,
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
    nodeName: "GQLViewer",
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
}

export class ViewerResolver {
  @gqlQuery({
    nodeName: "ViewerResolver",
    name: "viewer",
    type: "GQLViewer",
    args: [gqlContextType()],
  })
  viewer(context: RequestContext<ExampleViewer>): GQLViewer {
    return new GQLViewer(context.getViewer());
  }

  @gqlQuery({
    nodeName: "ViewerResolver",
    name: "timeDiff",
    type: GraphQLString,
    args: [
      {
        name: "time",
        type: "Date",
      },
      {
        name: "log",
        type: "JSON",
      },
    ],
  })
  timeDiff(time: Date, _log: any) {
    const diff = DateTime.now().diff(DateTime.fromJSDate(time));
    return diff.toString();
  }
}
