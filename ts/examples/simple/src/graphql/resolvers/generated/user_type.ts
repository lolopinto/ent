// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLObjectType,
  GraphQLID,
  GraphQLString,
  GraphQLNonNull,
  GraphQLList,
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLResolveInfo,
} from "graphql";
import { ID } from "ent/ent";
import { Context } from "src/graphql/context";
import { EventType } from "./event_type";
import { ContactType } from "./contact_type";
import User from "src/ent/user";

interface UserQueryArgs {
  id: ID;
}
export const UserType = new GraphQLObjectType({
  name: "User",
  fields: (): GraphQLFieldConfigMap<User, Context> => ({
    id: {
      type: GraphQLNonNull(GraphQLID),
    },
    firstName: {
      type: GraphQLNonNull(GraphQLString),
    },
    lastName: {
      type: GraphQLNonNull(GraphQLString),
    },
    emailAddress: {
      type: GraphQLNonNull(GraphQLString),
    },
    accountStatus: {
      type: GraphQLString,
    },
    createdEvents: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(EventType))),
      resolve: (user: User) => {
        return user.loadCreatedEvents();
      },
    },
    friends: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(UserType))),
      resolve: (user: User) => {
        return user.loadFriends();
      },
    },
    selfContact: {
      type: ContactType,
      resolve: (user: User) => {
        return user.loadSelfContact();
      },
    },
    invitedEvents: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(EventType))),
      resolve: (user: User) => {
        return user.loadInvitedEvents();
      },
    },
    eventsAttending: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(EventType))),
      resolve: (user: User) => {
        return user.loadEventsAttending();
      },
    },
    declinedEvents: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(EventType))),
      resolve: (user: User) => {
        return user.loadDeclinedEvents();
      },
    },
    maybeEvents: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(EventType))),
      resolve: (user: User) => {
        return user.loadMaybeEvents();
      },
    },
    contacts: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(ContactType))),
      resolve: (user: User) => {
        return user.loadContacts();
      },
    },
  }),
});

export const UserQuery: GraphQLFieldConfig<
  undefined,
  Context,
  UserQueryArgs
> = {
  type: UserType,
  args: {
    id: {
      description: "id",
      type: GraphQLID,
    },
  },
  resolve: async (
    _source,
    args: UserQueryArgs,
    context: Context,
    _info: GraphQLResolveInfo,
  ) => {
    return User.load(context.viewer, args.id);
  },
};
