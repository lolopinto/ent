/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import { GraphQLObjectType } from "graphql";
import { GraphQLConnectionType } from "@snowtop/ent/graphql";
import { UserToCreatedEventsEdge } from "../../../../ent";
import { EventType } from "../../../resolvers/internal";

var connType: GraphQLConnectionType<GraphQLObjectType, UserToCreatedEventsEdge>;

export const UserToCreatedEventsConnectionType = () => {
  if (connType === undefined) {
    connType = new GraphQLConnectionType("UserToCreatedEvents", EventType);
  }
  return connType;
};
