/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  GraphQLBoolean,
  GraphQLFieldConfig,
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLResolveInfo,
} from "graphql";
import { RequestContext, query } from "@snowtop/ent";
import { mustDecodeNullableIDFromGQLID } from "@snowtop/ent/graphql";
import { Holiday } from "../../../ent";
import { HolidayType } from "../../resolvers/internal";
import { ExampleViewer as ExampleViewerAlias } from "../../../viewer/viewer";

interface HolidayArgs {
  id: any;
  ids: any;
  extra: boolean | null;
}

export const HolidayQueryType: GraphQLFieldConfig<
  undefined,
  RequestContext<ExampleViewerAlias>,
  HolidayArgs
> = {
  type: new GraphQLList(new GraphQLNonNull(HolidayType)),
  args: {
    id: {
      description: "",
      type: GraphQLID,
    },
    ids: {
      description: "",
      type: new GraphQLList(new GraphQLNonNull(GraphQLID)),
    },
    extra: {
      description: "",
      type: GraphQLBoolean,
    },
  },
  resolve: async (
    _source,
    args,
    context: RequestContext<ExampleViewerAlias>,
    _info: GraphQLResolveInfo,
  ) => {
    const whereQueries = [
      mustDecodeNullableIDFromGQLID(args.id)
        ? query.Eq("id", mustDecodeNullableIDFromGQLID(args.id))
        : undefined,
      args.ids ? query.In("ids", ...args.ids) : undefined,
    ];

    if (whereQueries.filter((q) => q !== undefined).length === 0) {
      throw new Error("invalid query. must provid id or ids");
    }

    return Holiday.loadCustom(
      context.getViewer(),
      query.AndOptional(...whereQueries),
    );
  },
};
