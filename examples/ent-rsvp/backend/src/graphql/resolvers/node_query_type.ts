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
