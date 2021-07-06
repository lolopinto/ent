// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { GraphQLObjectType } from "graphql";
import { Data } from "@snowtop/ent";
import { GraphQLConnectionType } from "@snowtop/ent/graphql";
import { GuestType } from "src/graphql/resolvers/internal";

var connType: GraphQLConnectionType<GraphQLObjectType, Data>;

export const GuestGroupToGuestsConnectionType = () => {
  if (connType === undefined) {
    connType = new GraphQLConnectionType("GuestGroupToGuests", GuestType);
  }
  return connType;
};
