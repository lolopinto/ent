import {
  GraphQLFieldConfig,
  GraphQLID,
  GraphQLNonNull,
  GraphQLResolveInfo,
} from "graphql";
import { RequestContext } from "@snowtop/ent";
import { Tag } from "src/ent/";
import { TagType } from "src/graphql/resolvers/internal";

interface TagQueryArgs {
  id: string;
}

export const TagQueryType: GraphQLFieldConfig<
  undefined,
  RequestContext,
  TagQueryArgs
> = {
  type: TagType,
  args: {
    id: {
      description: "",
      type: GraphQLNonNull(GraphQLID),
    },
  },
  resolve: async (
    _source,
    args: TagQueryArgs,
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ) => {
    return Tag.load(context.getViewer(), args.id);
  },
};
