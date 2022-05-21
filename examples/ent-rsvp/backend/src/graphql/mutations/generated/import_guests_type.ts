// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLFieldConfig,
  GraphQLID,
  GraphQLNonNull,
  GraphQLResolveInfo,
} from "graphql";
import { GraphQLUpload } from "graphql-upload";
import { RequestContext } from "@snowtop/ent";
import { mustDecodeIDFromGQLID } from "@snowtop/ent/graphql";
import { EventType } from "src/graphql/resolvers/";
import { ImportGuestResolver } from "../import_guests";

interface importGuestsArgs {
  eventID: any;
  file: any;
}

export const ImportGuestsType: GraphQLFieldConfig<
  undefined,
  RequestContext,
  importGuestsArgs
> = {
  type: new GraphQLNonNull(EventType),
  args: {
    eventID: {
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
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ) => {
    const r = new ImportGuestResolver();
    return r.importGuests(
      context,
      mustDecodeIDFromGQLID(args.eventID),
      args.file,
    );
  },
};
