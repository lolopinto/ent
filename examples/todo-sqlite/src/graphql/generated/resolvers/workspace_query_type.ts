// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLFieldConfig,
  GraphQLID,
  GraphQLNonNull,
  GraphQLResolveInfo,
} from "graphql";
import { RequestContext, Viewer } from "@snowtop/ent";
import { Workspace } from "src/ent/";
import { WorkspaceType } from "src/graphql/resolvers/internal";

interface WorkspaceQueryArgs {
  id: string;
}

export const WorkspaceQueryType: GraphQLFieldConfig<
  undefined,
  RequestContext<Viewer>,
  WorkspaceQueryArgs
> = {
  type: WorkspaceType,
  args: {
    id: {
      description: "",
      type: new GraphQLNonNull(GraphQLID),
    },
  },
  resolve: async (
    _source,
    args: WorkspaceQueryArgs,
    context: RequestContext<Viewer>,
    _info: GraphQLResolveInfo,
  ) => {
    return Workspace.load(context.getViewer(), args.id);
  },
};
