// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLID,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLResolveInfo,
  GraphQLString,
} from "graphql";
import { RequestContext } from "@snowtop/ent";
import { mustDecodeIDFromGQLID } from "@snowtop/ent/graphql";
import { Address } from "src/ent/";
import CreateAddressAction, {
  AddressCreateInput,
} from "src/ent/address/actions/create_address_action";
import { AddressType } from "src/graphql/resolvers/";

interface customAddressCreateInput extends AddressCreateInput {
  ownerID: string;
}

interface AddressCreatePayload {
  address: Address;
}

export const AddressCreateInputType = new GraphQLInputObjectType({
  name: "AddressCreateInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    street: {
      type: GraphQLNonNull(GraphQLString),
    },
    city: {
      type: GraphQLNonNull(GraphQLString),
    },
    state: {
      type: GraphQLNonNull(GraphQLString),
    },
    zipCode: {
      type: GraphQLNonNull(GraphQLString),
    },
    apartment: {
      type: GraphQLString,
    },
    ownerID: {
      type: GraphQLNonNull(GraphQLID),
    },
    ownerType: {
      type: GraphQLNonNull(GraphQLString),
    },
  }),
});

export const AddressCreatePayloadType = new GraphQLObjectType({
  name: "AddressCreatePayload",
  fields: (): GraphQLFieldConfigMap<AddressCreatePayload, RequestContext> => ({
    address: {
      type: GraphQLNonNull(AddressType),
    },
  }),
});

export const AddressCreateType: GraphQLFieldConfig<
  undefined,
  RequestContext,
  { [input: string]: customAddressCreateInput }
> = {
  type: GraphQLNonNull(AddressCreatePayloadType),
  args: {
    input: {
      description: "",
      type: GraphQLNonNull(AddressCreateInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ): Promise<AddressCreatePayload> => {
    let address = await CreateAddressAction.create(context.getViewer(), {
      street: input.street,
      city: input.city,
      state: input.state,
      zipCode: input.zipCode,
      apartment: input.apartment,
      ownerID: mustDecodeIDFromGQLID(input.ownerID),
      ownerType: input.ownerType,
    }).saveX();
    return { address: address };
  },
};
