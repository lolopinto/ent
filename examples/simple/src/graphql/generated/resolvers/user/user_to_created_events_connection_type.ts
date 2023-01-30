/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import { GraphQLObjectType } from "graphql";
import { GraphQLConnectionType } from "@snowtop/ent/graphql";
import { UserToCreatedEventsEdge } from "../../../../ent";
import { EventType } from "../../../resolvers/internal";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

var connType: GraphQLConnectionType<
  GraphQLObjectType,
  UserToCreatedEventsEdge,
  ExampleViewerAlias
>;

export const UserToCreatedEventsConnectionType = () => {
  if (connType === undefined) {
    connType = new GraphQLConnectionType("UserToCreatedEvents", EventType);
  }
  return connType;
};
