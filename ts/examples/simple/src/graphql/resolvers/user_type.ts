import {
  //  graphql,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLID,
  GraphQLString,
  GraphQLEnumType,
  GraphQLNonNull,
  GraphQLList,
  GraphQLInt,
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLResolveInfo,
} from "graphql";
import { contactType } from "./contact_type";
import User from "src/ent/user";
import { eventType } from "./event_type";
import { Context } from "src/graphql/context";
import { ID } from "ent/ent";

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
  fields: (): GraphQLFieldConfigMap<
    User,
    Context,
    { [argName: string]: any }
  > => ({
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
    createdEvents: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(eventType))),
      description: "created events",
      resolve: async (user: User) => {
        return user.loadCreatedEvents();
      },
    },
    createdEventsCount: {
      type: GraphQLNonNull(GraphQLInt),
      description: "created events count",
      resolve: async (user: User) => {
        return user.loadCreatedEventsRawCountX();
      },
    },
    friends: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(userType))),
      description: "friends",
      resolve: async (user: User) => {
        return user.loadFriends();
      },
    },
    friendsCount: {
      type: GraphQLNonNull(GraphQLInt),
      description: "friendscount",
      resolve: async (user: User) => {
        return user.loadFriendsRawCountX();
      },
    },
  }),
});

interface userQueryArgs {
  id: ID;
}

export const userQuery: GraphQLFieldConfig<
  undefined,
  Context,
  userQueryArgs
> = {
  type: userType,
  args: {
    id: {
      description: "id",
      type: GraphQLID,
    },
  },
  resolve: async (_source, args, context, _info: GraphQLResolveInfo) => {
    console.log("sss");
    return User.load(context.viewer, args.id);
  },
};
