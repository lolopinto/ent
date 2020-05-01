import {
  //  graphql,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLID,
  GraphQLString,
  GraphQLEnumType,
  GraphQLNonNull,
  GraphQLList,
} from "graphql";
import { contactType } from "./contact";
import User from "src/ent/user";

const accountStatusEnum = new GraphQLEnumType({
  name: "ACCOUNT_STATUS",
  values: {
    UNVERIFIED: {
      value: "UNVERIFIED",
      description: "unverified account",
    },
    VERIFIED: {
      value: "VERIFIED",
      description: "verified account",
    },
    DEACTIVATED: {
      value: "DEACTIVATED",
      description: "deactivated account",
    },
    DISABLED: {
      value: "DISABLED",
      description: "disabled account",
    },
  },
});

export const userType = new GraphQLObjectType({
  name: "User",
  description: "User",
  fields: () => ({
    id: {
      type: GraphQLNonNull(GraphQLID),
      description: "id",
    },
    firstName: {
      type: GraphQLNonNull(GraphQLString),
      description: "first name",
    },
    lastName: {
      type: GraphQLNonNull(GraphQLString),
      description: "last name",
    },
    emailAddress: {
      type: GraphQLNonNull(GraphQLString),
      description: "emailAddress",
    },
    accountStatus: {
      type: accountStatusEnum,
      description: "account status",
    },
    selfContact: {
      type: contactType,
      description: "self contact for user",
      resolve: async (user: User) => {
        return user.loadSelfContact();
      },
    },
    contacts: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(contactType))),
      description: "user's contacts",
      resolve: async (user: User) => {
        return user.loadContacts();
      },
    },
  }),
});
