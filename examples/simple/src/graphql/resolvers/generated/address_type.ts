// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLFieldConfigMap,
  GraphQLID,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from "graphql";
import { RequestContext } from "@snowtop/ent";
import { GraphQLNodeInterface, nodeIDEncoder } from "@snowtop/ent/graphql";
import { Address } from "src/ent/";

export const AddressType = new GraphQLObjectType({
  name: "Address",
  fields: (): GraphQLFieldConfigMap<Address, RequestContext> => ({
    id: {
      type: GraphQLNonNull(GraphQLID),
      resolve: nodeIDEncoder,
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
  interfaces: [GraphQLNodeInterface],
  isTypeOf(obj) {
    return obj instanceof Address;
  },
});
