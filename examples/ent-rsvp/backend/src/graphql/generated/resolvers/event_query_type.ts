// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLFieldConfig,
  GraphQLNonNull,
  GraphQLResolveInfo,
  GraphQLString,
} from "graphql";
import { RequestContext, Viewer } from "@snowtop/ent";
import { EventResolver } from "src/graphql/resolvers/event";
import { EventType } from "src/graphql/resolvers/internal";

interface EventArgs {
  slug: string;
}

export const EventQueryType: GraphQLFieldConfig<
  undefined,
  RequestContext<Viewer>,
  EventArgs
> = {
  type: EventType,
  args: {
    slug: {
      description: "",
      type: new GraphQLNonNull(GraphQLString),
    },
  },
  resolve: async (
    _source,
    args,
    context: RequestContext<Viewer>,
    _info: GraphQLResolveInfo,
  ) => {
    const r = new EventResolver();
    return r.event(context, args.slug);
  },
};
