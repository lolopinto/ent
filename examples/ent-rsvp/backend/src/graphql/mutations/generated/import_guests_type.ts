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

export const ImportGuestsType: GraphQLFieldConfig<undefined, RequestContext> = {
  type: GraphQLNonNull(EventType),
  args: {
    eventID: {
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
    args: { eventID; file },
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
