// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { GraphQLConnectionType } from "@lolopinto/ent/graphql";
import { ContactType } from "src/graphql/resolvers/";

export const UserToContactsConnectionType = () => {
  return new GraphQLConnectionType("UserToContacts", ContactType);
};
