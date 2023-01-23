/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import { GraphQLObjectType } from "graphql";
import { Data } from "@snowtop/ent";
import { GraphQLConnectionType } from "@snowtop/ent/graphql";
import { UserType } from "../../../resolvers/internal";

var connType: GraphQLConnectionType<GraphQLObjectType, Data>;

export const RootToUserConnectionConnectionType = () => {
  if (connType === undefined) {
    connType = new GraphQLConnectionType("RootToUserConnection", UserType);
  }
  return connType;
};
