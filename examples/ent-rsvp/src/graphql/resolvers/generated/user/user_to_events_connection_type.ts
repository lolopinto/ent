// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { GraphQLConnectionType } from "@lolopinto/ent/graphql";
import { EventType } from "src/graphql/resolvers/";

export const UserToEventsConnectionType = () => {
  return new GraphQLConnectionType("UserToEvents", EventType);
};
