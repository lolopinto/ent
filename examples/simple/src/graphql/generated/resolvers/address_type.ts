/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  GraphQLFieldConfigMap,
  GraphQLID,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from "graphql";
import { RequestContext } from "@snowtop/ent";
import {
  GraphQLEdgeConnection,
  GraphQLNodeInterface,
  nodeIDEncoder,
} from "@snowtop/ent/graphql";
import { Address, AddressToHostedEventsQuery } from "../../../ent";
import { AddressToHostedEventsConnectionType } from "../../resolvers/internal";

export const AddressType = new GraphQLObjectType({
  name: "Address",
  fields: (): GraphQLFieldConfigMap<Address, RequestContext> => ({
    id: {
      type: new GraphQLNonNull(GraphQLID),
      resolve: nodeIDEncoder,
    },
    streetName: {
      type: new GraphQLNonNull(GraphQLString),
    },
    city: {
      type: new GraphQLNonNull(GraphQLString),
    },
    state: {
      type: new GraphQLNonNull(GraphQLString),
    },
    zip: {
      type: new GraphQLNonNull(GraphQLString),
    },
    apartment: {
      type: GraphQLString,
    },
    country: {
      type: new GraphQLNonNull(GraphQLString),
    },
    hostedEvents: {
      type: new GraphQLNonNull(AddressToHostedEventsConnectionType()),
      args: {
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
      resolve: (address: Address, args: {}, context: RequestContext) => {
        return new GraphQLEdgeConnection(
          address.viewer,
          address,
          (v, address: Address) => AddressToHostedEventsQuery.query(v, address),
          args,
        );
      },
    },
  }),
  interfaces: [GraphQLNodeInterface],
  isTypeOf(obj) {
    return obj instanceof Address;
  },
});