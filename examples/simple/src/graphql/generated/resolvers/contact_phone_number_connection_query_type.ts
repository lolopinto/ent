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
import { ContactPhoneNumber } from "../../../ent";
import { ContactPhoneNumberSortColumnType } from "./enums_type";
import { RootToContactPhoneNumberConnectionType } from "../../resolvers/internal";
import { ExampleViewer as ExampleViewerAlias } from "../../../viewer/viewer";

interface ContactPhoneNumberConnectionArgs {
  ids: any;
  sortCol: any;
  first: number | null;
  after: string | null;
  last: number | null;
  before: string | null;
}

export const ContactPhoneNumberConnectionQueryType: GraphQLFieldConfig<
  undefined,
  RequestContext<ExampleViewerAlias>,
  ContactPhoneNumberConnectionArgs
> = {
  type: new GraphQLNonNull(RootToContactPhoneNumberConnectionType()),
  args: {
    ids: {
      description: "",
      type: new GraphQLList(new GraphQLNonNull(GraphQLID)),
    },
    sortCol: {
      description: "",
      type: ContactPhoneNumberSortColumnType,
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
          loadEntOptions: ContactPhoneNumber.loaderOptions(),
          clause: query.UuidIn("id", args.ids),
          name: "ContactPhoneNumber",
          // use sortCol value or created_at (not sorted)
          sortColumn: args.sortCol ?? "created_at",
        });
      },
      args,
    );
  },
};
