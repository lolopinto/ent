// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLObjectType,
  GraphQLID,
  GraphQLString,
  GraphQLNonNull,
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLResolveInfo,
} from "graphql";
import { ID, RequestContext } from "@lolopinto/ent";
import { Address } from "src/ent/";

interface AddressQueryArgs {
  id: ID;
}

export const AddressType = new GraphQLObjectType({
  name: "Address",
  fields: (): GraphQLFieldConfigMap<Address, RequestContext> => ({
    id: {
      type: GraphQLNonNull(GraphQLID),
    },
    streetName: {
      type: GraphQLNonNull(GraphQLString),
    },
    city: {
      type: GraphQLNonNull(GraphQLString),
    },
    state: {
      type: GraphQLNonNull(GraphQLString),
    },
    zip: {
      type: GraphQLNonNull(GraphQLString),
    },
    apartment: {
      type: GraphQLString,
    },
    country: {
      type: GraphQLNonNull(GraphQLString),
    },
  }),
});

export const AddressQuery: GraphQLFieldConfig<
  undefined,
  RequestContext,
  AddressQueryArgs
> = {
  type: AddressType,
  args: {
    id: {
      description: "",
      type: GraphQLNonNull(GraphQLID),
    },
  },
  resolve: async (
    _source,
    args: AddressQueryArgs,
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ) => {
    return Address.load(context.getViewer(), args.id);
  },
};
