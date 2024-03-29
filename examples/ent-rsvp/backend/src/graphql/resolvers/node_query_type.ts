import {
  GraphQLFieldConfig,
  GraphQLID,
  GraphQLNonNull,
  GraphQLResolveInfo,
} from "graphql";
import { RequestContext } from "@snowtop/ent";
import {
  EntNodeResolver,
  GraphQLNodeInterface,
  registerResolver,
  resolveID,
} from "@snowtop/ent/graphql";
import { NodeType } from "src/ent/generated/types";
import { loadEntByType } from "src/ent/generated/loadAny";

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
  RequestContext,
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
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ) => {
    return resolveID(context.getViewer(), args.id);
  },
};
