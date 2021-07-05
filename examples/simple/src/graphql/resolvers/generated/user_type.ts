// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLFieldConfigMap,
  GraphQLID,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from "graphql";
import { RequestContext } from "@snowtop/ent";
import {
  GraphQLEdgeConnection,
  GraphQLNodeInterface,
  nodeIDEncoder,
} from "@snowtop/ent/graphql";
import {
  User,
  UserToContactsQuery,
  UserToCreatedEventsQuery,
  UserToDeclinedEventsQuery,
  UserToEventsAttendingQuery,
  UserToFriendsQuery,
  UserToHostedEventsQuery,
  UserToInvitedEventsQuery,
  UserToMaybeEventsQuery,
} from "src/ent/";
import {
  ContactType,
  UserToContactsConnectionType,
  UserToCreatedEventsConnectionType,
  UserToDeclinedEventsConnectionType,
  UserToEventsAttendingConnectionType,
  UserToFriendsConnectionType,
  UserToHostedEventsConnectionType,
  UserToInvitedEventsConnectionType,
  UserToMaybeEventsConnectionType,
} from "src/graphql/resolvers/internal";

export const UserType = new GraphQLObjectType({
  name: "User",
  fields: (): GraphQLFieldConfigMap<User, RequestContext> => ({
    id: {
      type: GraphQLNonNull(GraphQLID),
      resolve: nodeIDEncoder,
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
    bio: {
      type: GraphQLString,
    },
    nicknames: {
      type: GraphQLList(GraphQLNonNull(GraphQLString)),
    },
    selfContact: {
      type: ContactType,
      resolve: (user: User, args: {}, context: RequestContext) => {
        return user.loadSelfContact();
      },
    },
    createdEvents: {
      type: GraphQLNonNull(UserToCreatedEventsConnectionType()),
      args: {
        first: {
          description: "",
          type: GraphQLInt,
        },
        after: {
          description: "",
          type: GraphQLString,
        },
        last: {
          description: "",
          type: GraphQLInt,
        },
        before: {
          description: "",
          type: GraphQLString,
        },
      },
      resolve: (user: User, args: {}, context: RequestContext) => {
        return new GraphQLEdgeConnection(
          user.viewer,
          user,
          (v, user: User) => UserToCreatedEventsQuery.query(v, user),
          args,
        );
      },
    },
    declinedEvents: {
      type: GraphQLNonNull(UserToDeclinedEventsConnectionType()),
      args: {
        first: {
          description: "",
          type: GraphQLInt,
        },
        after: {
          description: "",
          type: GraphQLString,
        },
        last: {
          description: "",
          type: GraphQLInt,
        },
        before: {
          description: "",
          type: GraphQLString,
        },
      },
      resolve: (user: User, args: {}, context: RequestContext) => {
        return new GraphQLEdgeConnection(
          user.viewer,
          user,
          (v, user: User) => UserToDeclinedEventsQuery.query(v, user),
          args,
        );
      },
    },
    eventsAttending: {
      type: GraphQLNonNull(UserToEventsAttendingConnectionType()),
      args: {
        first: {
          description: "",
          type: GraphQLInt,
        },
        after: {
          description: "",
          type: GraphQLString,
        },
        last: {
          description: "",
          type: GraphQLInt,
        },
        before: {
          description: "",
          type: GraphQLString,
        },
      },
      resolve: (user: User, args: {}, context: RequestContext) => {
        return new GraphQLEdgeConnection(
          user.viewer,
          user,
          (v, user: User) => UserToEventsAttendingQuery.query(v, user),
          args,
        );
      },
    },
    friends: {
      type: GraphQLNonNull(UserToFriendsConnectionType()),
      args: {
        first: {
          description: "",
          type: GraphQLInt,
        },
        after: {
          description: "",
          type: GraphQLString,
        },
        last: {
          description: "",
          type: GraphQLInt,
        },
        before: {
          description: "",
          type: GraphQLString,
        },
      },
      resolve: (user: User, args: {}, context: RequestContext) => {
        return new GraphQLEdgeConnection(
          user.viewer,
          user,
          (v, user: User) => UserToFriendsQuery.query(v, user),
          args,
        );
      },
    },
    invitedEvents: {
      type: GraphQLNonNull(UserToInvitedEventsConnectionType()),
      args: {
        first: {
          description: "",
          type: GraphQLInt,
        },
        after: {
          description: "",
          type: GraphQLString,
        },
        last: {
          description: "",
          type: GraphQLInt,
        },
        before: {
          description: "",
          type: GraphQLString,
        },
      },
      resolve: (user: User, args: {}, context: RequestContext) => {
        return new GraphQLEdgeConnection(
          user.viewer,
          user,
          (v, user: User) => UserToInvitedEventsQuery.query(v, user),
          args,
        );
      },
    },
    maybeEvents: {
      type: GraphQLNonNull(UserToMaybeEventsConnectionType()),
      args: {
        first: {
          description: "",
          type: GraphQLInt,
        },
        after: {
          description: "",
          type: GraphQLString,
        },
        last: {
          description: "",
          type: GraphQLInt,
        },
        before: {
          description: "",
          type: GraphQLString,
        },
      },
      resolve: (user: User, args: {}, context: RequestContext) => {
        return new GraphQLEdgeConnection(
          user.viewer,
          user,
          (v, user: User) => UserToMaybeEventsQuery.query(v, user),
          args,
        );
      },
    },
    userToHostedEvents: {
      type: GraphQLNonNull(UserToHostedEventsConnectionType()),
      args: {
        first: {
          description: "",
          type: GraphQLInt,
        },
        after: {
          description: "",
          type: GraphQLString,
        },
        last: {
          description: "",
          type: GraphQLInt,
        },
        before: {
          description: "",
          type: GraphQLString,
        },
      },
      resolve: (user: User, args: {}, context: RequestContext) => {
        return new GraphQLEdgeConnection(
          user.viewer,
          user,
          (v, user: User) => UserToHostedEventsQuery.query(v, user),
          args,
        );
      },
    },
    contacts: {
      type: GraphQLNonNull(UserToContactsConnectionType()),
      args: {
        first: {
          description: "",
          type: GraphQLInt,
        },
        after: {
          description: "",
          type: GraphQLString,
        },
        last: {
          description: "",
          type: GraphQLInt,
        },
        before: {
          description: "",
          type: GraphQLString,
        },
      },
      resolve: (user: User, args: {}, context: RequestContext) => {
        return new GraphQLEdgeConnection(
          user.viewer,
          user,
          (v, user: User) => UserToContactsQuery.query(v, user),
          args,
        );
      },
    },
    fullName: {
      type: GraphQLNonNull(GraphQLString),
    },
    bar: {
      type: GraphQLString,
      resolve: (user: User, args: {}, context: RequestContext) => {
        return user.getUserBar();
      },
    },
    contactSameDomain: {
      type: ContactType,
      resolve: async (user: User, args: {}, context: RequestContext) => {
        return user.getFirstContactSameDomain();
      },
    },
    contactsSameDomain: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(ContactType))),
      resolve: async (user: User, args: {}, context: RequestContext) => {
        return user.getContactsSameDomain();
      },
    },
    contactsSameDomainNullable: {
      type: GraphQLList(GraphQLNonNull(ContactType)),
      resolve: async (user: User, args: {}, context: RequestContext) => {
        return user.getContactsSameDomainNullable();
      },
    },
    contactsSameDomainNullableContents: {
      type: GraphQLNonNull(GraphQLList(ContactType)),
      resolve: async (user: User, args: {}, context: RequestContext) => {
        return user.getContactsSameDomainNullableContents();
      },
    },
    contactsSameDomainNullableContentsAndList: {
      type: GraphQLList(ContactType),
      resolve: async (user: User, args: {}, context: RequestContext) => {
        return user.getContactsSameDomainNullableContentsAndList();
      },
    },
  }),
  interfaces: [GraphQLNodeInterface],
  isTypeOf(obj) {
    return obj instanceof User;
  },
});
