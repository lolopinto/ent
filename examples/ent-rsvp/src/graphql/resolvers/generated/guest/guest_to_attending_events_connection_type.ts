// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { GraphQLConnectionType } from "@lolopinto/ent/graphql";
import { EventActivityType } from "src/graphql/resolvers/";

export const GuestToAttendingEventsConnectionType = () => {
  return new GraphQLConnectionType("GuestToAttendingEvents", EventActivityType);
};
