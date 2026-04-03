import type { GraphQLFieldConfig, GraphQLResolveInfo } from "graphql";
import type { RequestContext, Viewer } from "@snowtop/ent";
import { GraphQLID, GraphQLNonNull } from "graphql";
import {
  EntNodeResolver,
  GraphQLNodeInterface,
  registerResolver,
  resolveID,
} from "@snowtop/ent/graphql";
import { loadEntByType } from "../../ent/generated/loadAny";
import { NodeType } from "../../ent/generated/types";

interface NodeQueryArgs {
  id: string;
}

const resolver = new EntNodeResolver((v, nodeType, id) =>
  loadEntByType(v, nodeType as NodeType, id),
);
registerResolver("entNode", resolver);
// add any custom Node Resolvers here

export const NodeQueryType: GraphQLFieldConfig<
  undefined,
  RequestContext<Viewer>,
  NodeQueryArgs
> = {
  type: GraphQLNodeInterface,
  args: {
    id: {
      description: "",
      type: new GraphQLNonNull(GraphQLID),
    },
  },
  resolve: async (
    _source,
    args: NodeQueryArgs,
    context: RequestContext<Viewer>,
    _info: GraphQLResolveInfo,
  ) => {
    return resolveID(context.getViewer(), args.id);
  },
};
