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
import { ID } from "ent/core/ent";
import { RequestContext } from "ent/auth/context";
import { EventType } from "./event_type";
import { ContactType } from "./contact_type";
import User from "src/ent/user";

interface UserQueryArgs {
  id: ID;
}

export const UserType = new GraphQLObjectType({
  name: "User",
  fields: (): GraphQLFieldConfigMap<User, RequestContext> => ({
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
    phoneNumber: {
      type: GraphQLString,
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
    fullName: {
      type: GraphQLNonNull(GraphQLString),
    },
    bar: {
      type: GraphQLString,
      resolve: (user: User) => {
        return user.getUserBar();
      },
    },
    contactSameDomain: {
      type: ContactType,
      resolve: async (user: User) => {
        return user.getFirstContactSameDomain();
      },
    },
    contactsSameDomain: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(ContactType))),
      resolve: async (user: User) => {
        return user.getContactsSameDomain();
      },
    },
    contactsSameDomainNullable: {
      type: GraphQLList(GraphQLNonNull(ContactType)),
      resolve: async (user: User) => {
        return user.getContactsSameDomainNullable();
      },
    },
    contactsSameDomainNullableContents: {
      type: GraphQLNonNull(GraphQLList(ContactType)),
      resolve: async (user: User) => {
        return user.getContactsSameDomainNullableContents();
      },
    },
    contactsSameDomainNullableContentsAndList: {
      type: GraphQLList(ContactType),
      resolve: async (user: User) => {
        return user.getContactsSameDomainNullableContentsAndList();
      },
    },
  }),
});

export const UserQuery: GraphQLFieldConfig<
  undefined,
  RequestContext,
  UserQueryArgs
> = {
  type: UserType,
  args: {
    id: {
      description: "",
      type: GraphQLNonNull(GraphQLID),
    },
  },
  resolve: async (
    _source,
    args: UserQueryArgs,
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ) => {
    return User.load(context.getViewer(), args.id);
  },
};
