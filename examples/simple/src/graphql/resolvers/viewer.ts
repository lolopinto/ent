import { gqlContextType, gqlQuery } from "@snowtop/ent/graphql";
import { GraphQLString } from "graphql";
import { RequestContext } from "@snowtop/ent";

import { ExampleViewer } from "../../viewer/viewer";
import { DateTime } from "luxon";
import { GQLViewer } from "./gql_viewer";

export class ViewerResolver {
  @gqlQuery({
    class: "ViewerResolver",
    name: "viewer",
    type: "GQLViewer",
    args: [gqlContextType()],
  })
  viewer(context: RequestContext<ExampleViewer>): GQLViewer {
    return new GQLViewer(context.getViewer());
  }

  @gqlQuery({
    class: "ViewerResolver",
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
