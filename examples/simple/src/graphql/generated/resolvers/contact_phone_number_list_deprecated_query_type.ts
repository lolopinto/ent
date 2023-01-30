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
import {
  mustDecodeIDFromGQLID,
  mustDecodeNullableIDFromGQLID,
} from "@snowtop/ent/graphql";
import { ContactPhoneNumber } from "../../../ent";
import { ContactPhoneNumberType } from "../../resolvers/internal";
import { ExampleViewer as ExampleViewerAlias } from "../../../viewer/viewer";

interface ContactPhoneNumberListDeprecatedArgs {
  id: any;
  ids: any;
  extra: boolean | null;
}

export const ContactPhoneNumberListDeprecatedQueryType: GraphQLFieldConfig<
  undefined,
  RequestContext<ExampleViewerAlias>,
  ContactPhoneNumberListDeprecatedArgs
> = {
  type: new GraphQLList(new GraphQLNonNull(ContactPhoneNumberType)),
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
    args.id = mustDecodeNullableIDFromGQLID(args.id);
    args.ids = args.ids
      ? args.ids.map((i: any) => mustDecodeIDFromGQLID(i))
      : undefined;

    const whereQueries = [
      args.id ? query.Eq("id", args.id) : undefined,
      args.ids ? query.In("id", ...args.ids) : undefined,
    ];

    if (whereQueries.filter((q) => q !== undefined).length === 0) {
      throw new Error("invalid query. must provid id or ids");
    }

    return ContactPhoneNumber.loadCustom(
      context.getViewer(),
      query.AndOptional(...whereQueries),
    );
  },
};
