/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  GraphQLFieldConfig,
  GraphQLID,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLResolveInfo,
  GraphQLString,
} from "graphql";
import { CustomClauseQuery, RequestContext, query } from "@snowtop/ent";
import {
  GraphQLEdgeConnection,
  mustDecodeIDFromGQLID,
} from "@snowtop/ent/graphql";
import { Holiday } from "../../../ent";
import { HolidaySortColumnType } from "./enums_type";
import { RootToHolidayConnectionType } from "../../resolvers/internal";
import { ExampleViewer as ExampleViewerAlias } from "../../../viewer/viewer";

interface HolidayConnectionArgs {
  ids: any;
  sortCol: any;
  first: number | null;
  after: string | null;
  last: number | null;
  before: string | null;
}

export const HolidayConnectionQueryType: GraphQLFieldConfig<
  undefined,
  RequestContext<ExampleViewerAlias>,
  HolidayConnectionArgs
> = {
  type: new GraphQLNonNull(RootToHolidayConnectionType()),
  args: {
    ids: {
      description: "",
      type: new GraphQLList(new GraphQLNonNull(GraphQLID)),
    },
    sortCol: {
      description: "",
      type: HolidaySortColumnType,
    },
    first: {
      description: "",
      type: GraphQLInt,
    },
    after: {
      description: "",
      type: GraphQLString,
    },
    last: {
      description: "",
      type: GraphQLInt,
    },
    before: {
      description: "",
      type: GraphQLString,
    },
  },
  resolve: async (
    _source,
    args,
    context: RequestContext<ExampleViewerAlias>,
    _info: GraphQLResolveInfo,
  ) => {
    args.ids = args.ids
      ? args.ids.map((i: any) => mustDecodeIDFromGQLID(i))
      : undefined;
    return new GraphQLEdgeConnection(
      context.getViewer(),
      (v) => {
        return new CustomClauseQuery(context.getViewer(), {
          loadEntOptions: Holiday.loaderOptions(),
          clause: query.UuidIn("id", args.ids),
          name: "Holiday",
          // use sortCol value or created_at (not sorted)
          sortColumn: args.sortCol ?? "created_at",
        });
      },
      args,
    );
  },
};
