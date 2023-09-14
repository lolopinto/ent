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
import { Contact } from "../../../ent";
import { ContactArgInputType } from "../mutations/input/contact_arg_input_type";
import { ContactSortColumnType } from "./enums_type";
import { RootToContactConnectionType } from "../../resolvers/internal";
import { ExampleViewer as ExampleViewerAlias } from "../../../viewer/viewer";

interface ContactConnectionArgs {
  ids: any;
  sortCol: any;
  query: any;
  first: number | null;
  after: string | null;
  last: number | null;
  before: string | null;
}

export const ContactConnectionQueryType: GraphQLFieldConfig<
  undefined,
  RequestContext<ExampleViewerAlias>,
  ContactConnectionArgs
> = {
  type: new GraphQLNonNull(RootToContactConnectionType()),
  description: "custom query for contact. connection",
  args: {
    ids: {
      description: "",
      type: new GraphQLList(new GraphQLNonNull(GraphQLID)),
    },
    sortCol: {
      description: "",
      type: ContactSortColumnType,
    },
    query: {
      description: "",
      type: ContactArgInputType,
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
          loadEntOptions: Contact.loaderOptions(),
          clause: query.UuidIn("id", args.ids),
          name: "Contact",
          orderby: [
            {
              // use sortCol value or created_at (not sorted)
              column: args.sortCol ?? "created_at",
              direction: "DESC",
            },
          ],
        });
      },
      args,
    );
  },
};
