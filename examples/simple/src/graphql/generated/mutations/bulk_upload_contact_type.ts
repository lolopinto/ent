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
import { GraphQLContactLabel2 } from "../../mutations/custom_enum";
import { ImportContactResolver } from "../../mutations/import_contact";
import { ContactLabelType, UserType } from "../../resolvers";
import { ExampleViewer as ExampleViewerAlias } from "../../../viewer/viewer";

interface BulkUploadContactArgs {
  userId: any;
  file: any;
  defaultLabel: any;
  defaultLabel2: any;
}

export const BulkUploadContactType: GraphQLFieldConfig<
  undefined,
  RequestContext<ExampleViewerAlias>,
  BulkUploadContactArgs
> = {
  type: new GraphQLNonNull(UserType),
  args: {
    userId: {
      description: "",
      type: new GraphQLNonNull(GraphQLID),
    },
    file: {
      description: "",
      type: new GraphQLNonNull(GraphQLUpload),
    },
    defaultLabel: {
      description: "",
      type: ContactLabelType,
    },
    defaultLabel2: {
      description: "",
      type: GraphQLContactLabel2,
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
      mustDecodeIDFromGQLID(args.userId.toString()),
      args.file,
      args.defaultLabel,
      args.defaultLabel2,
    );
  },
};
