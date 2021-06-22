// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { GraphQLObjectType } from "graphql";
import { Data } from "@snowtop/snowtop-ts";
import { GraphQLConnectionType } from "@snowtop/snowtop-ts/graphql";
import { ContactType } from "src/graphql/resolvers/internal";

var connType: GraphQLConnectionType<GraphQLObjectType, Data>;

export const UserToContactsConnectionType = () => {
  if (connType === undefined) {
    connType = new GraphQLConnectionType("UserToContacts", ContactType);
  }
  return connType;
};
