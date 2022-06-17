/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  GraphQLFieldConfig,
  GraphQLID,
  GraphQLNonNull,
  GraphQLResolveInfo,
} from "graphql";
import { GraphQLUpload } from "graphql-upload";
import { RequestContext } from "@snowtop/ent";
import { mustDecodeIDFromGQLID } from "@snowtop/ent/graphql";
import { UserType } from "../../resolvers";
import { ExampleViewer as ExampleViewerAlias } from "../../../viewer/viewer";
import { ImportContactResolver } from "../../mutations/import_contact";

interface bulkUploadContactArgs {
  userID: any;
  file: any;
}

export const BulkUploadContactType: GraphQLFieldConfig<
  undefined,
  RequestContext<ExampleViewerAlias>,
  bulkUploadContactArgs
> = {
  type: new GraphQLNonNull(UserType),
  args: {
    userID: {
      description: "",
      type: new GraphQLNonNull(GraphQLID),
    },
    file: {
      description: "",
      type: new GraphQLNonNull(GraphQLUpload),
    },
  },
  resolve: async (
    _source,
    args,
    context: RequestContext<ExampleViewerAlias>,
    _info: GraphQLResolveInfo,
  ) => {
    const r = new ImportContactResolver();
    return r.bulkUploadContact(
      context,
      mustDecodeIDFromGQLID(args.userID),
      args.file,
    );
  },
};
