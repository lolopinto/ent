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
import { File } from "../../../ent";
import { FileArgInputType } from "../mutations/input/file_arg_input_type";
import { FileSortColumnType } from "./enums_type";
import { RootToFileConnectionType } from "../../resolvers/internal";
import { ExampleViewer as ExampleViewerAlias } from "../../../viewer/viewer";

interface FileConnectionArgs {
  ids: any;
  sortCol: any;
  query: any;
  first: number | null;
  after: string | null;
  last: number | null;
  before: string | null;
}

export const FileConnectionQueryType: GraphQLFieldConfig<
  undefined,
  RequestContext<ExampleViewerAlias>,
  FileConnectionArgs
> = {
  type: new GraphQLNonNull(RootToFileConnectionType()),
  description: "custom query for file. connection",
  args: {
    ids: {
      description: "",
      type: new GraphQLList(new GraphQLNonNull(GraphQLID)),
    },
    sortCol: {
      description: "",
      type: FileSortColumnType,
    },
    query: {
      description: "",
      type: FileArgInputType,
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
      ? args.ids.map((i: any) => mustDecodeIDFromGQLID(i.toString()))
      : undefined;
    return new GraphQLEdgeConnection(
      context.getViewer(),
      (v) => {
        return new CustomClauseQuery(context.getViewer(), {
          loadEntOptions: File.loaderOptions(),
          clause: query.UuidIn("id", args.ids),
          name: "File",
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
