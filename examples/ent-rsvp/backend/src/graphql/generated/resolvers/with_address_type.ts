// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { GraphQLUnionType } from "graphql";
import { EventActivityType, GuestType } from "src/graphql/resolvers/internal";

export const WithAddressType = new GraphQLUnionType({
  name: "WithAddress",
  types: () => [GuestType, EventActivityType],
});
