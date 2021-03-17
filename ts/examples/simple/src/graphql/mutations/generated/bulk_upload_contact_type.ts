// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLID,
  GraphQLNonNull,
  GraphQLFieldConfig,
  GraphQLResolveInfo,
} from "graphql";
import { RequestContext } from "@lolopinto/ent";
import { mustDecodeIDFromGQLID } from "@lolopinto/ent/graphql";
import { ImportContactResolver } from "../import_contact";
import { UserType } from "src/graphql/resolvers/";
import { GraphQLUpload } from "graphql-upload";

export const BulkUploadContactType: GraphQLFieldConfig<
  undefined,
  RequestContext
> = {
  type: GraphQLNonNull(UserType),
  args: {
    userID: {
      description: "",
      type: GraphQLNonNull(GraphQLID),
    },
    file: {
      description: "",
      type: GraphQLNonNull(GraphQLUpload),
    },
  },
  resolve: async (
    _source,
    { userID, file },
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ) => {
    const r = new ImportContactResolver();
    return r.bulkUploadContact(context, mustDecodeIDFromGQLID(userID), file);
  },
};
