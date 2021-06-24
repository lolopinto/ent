import {
  GraphQLID,
  GraphQLNonNull,
  GraphQLFieldConfig,
  GraphQLResolveInfo,
} from "graphql";
import { RequestContext } from "@snowtop/snowtop-ts";
import {
  GraphQLNodeInterface,
  registerResolver,
  EntNodeResolver,
  resolveID,
} from "@snowtop/snowtop-ts/graphql";
import { loadEntByType } from "src/ent/loadAny";

interface NodeQueryArgs {
  id: string;
}

const resolver = new EntNodeResolver(loadEntByType);
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
      type: GraphQLNonNull(GraphQLID),
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
