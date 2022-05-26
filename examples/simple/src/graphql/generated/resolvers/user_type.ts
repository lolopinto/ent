/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

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
  UserToCommentsQuery,
  UserToContactsQuery,
  UserToCreatedEventsQuery,
  UserToDeclinedEventsQuery,
  UserToEventsAttendingQuery,
  UserToFriendsQuery,
  UserToHostedEventsQuery,
  UserToInvitedEventsQuery,
  UserToLikersQuery,
  UserToLikesQuery,
  UserToMaybeEventsQuery,
} from "../../../ent";
import {
  ContactType,
  UserDaysOffType,
  UserNestedObjectListType,
  UserPreferredShiftType,
  UserPrefsDiffType,
  UserPrefsStruct2Type,
  UserPrefsStructType,
  UserSuperNestedObjectType,
  UserToCommentsConnectionType,
  UserToContactsConnectionType,
  UserToCreatedEventsConnectionType,
  UserToDeclinedEventsConnectionType,
  UserToEventsAttendingConnectionType,
  UserToFriendsConnectionType,
  UserToHostedEventsConnectionType,
  UserToInvitedEventsConnectionType,
  UserToLikersConnectionType,
  UserToLikesConnectionType,
  UserToMaybeEventsConnectionType,
} from "../../resolvers/internal";

export const UserType = new GraphQLObjectType({
  name: "User",
  fields: (): GraphQLFieldConfigMap<User, RequestContext> => ({
    id: {
      type: new GraphQLNonNull(GraphQLID),
      resolve: nodeIDEncoder,
    },
    firstName: {
      type: new GraphQLNonNull(GraphQLString),
    },
    lastName: {
      type: new GraphQLNonNull(GraphQLString),
    },
    emailAddress: {
      type: new GraphQLNonNull(GraphQLString),
    },
    phoneNumber: {
      type: GraphQLString,
    },
    accountStatus: {
      type: GraphQLString,
      resolve: async (user: User, args: {}, context: RequestContext) => {
        return user.accountStatus();
      },
    },
    bio: {
      type: GraphQLString,
    },
    nicknames: {
      type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
    },
    prefs: {
      type: UserPrefsStructType,
      resolve: async (user: User, args: {}, context: RequestContext) => {
        return user.prefs();
      },
    },
    prefsList: {
      type: new GraphQLList(new GraphQLNonNull(UserPrefsStruct2Type)),
      resolve: async (user: User, args: {}, context: RequestContext) => {
        return user.prefsList();
      },
    },
    prefsDiff: {
      type: UserPrefsDiffType,
      resolve: async (user: User, args: {}, context: RequestContext) => {
        return user.prefsDiff();
      },
    },
    daysOff: {
      type: new GraphQLList(new GraphQLNonNull(UserDaysOffType)),
    },
    preferredShift: {
      type: new GraphQLList(new GraphQLNonNull(UserPreferredShiftType)),
    },
    timeInMs: {
      type: GraphQLString,
    },
    funUuids: {
      type: new GraphQLList(new GraphQLNonNull(GraphQLID)),
    },
    newCol: {
      type: GraphQLString,
    },
    newCol2: {
      type: GraphQLString,
    },
    superNestedObject: {
      type: UserSuperNestedObjectType,
    },
    nestedList: {
      type: new GraphQLList(new GraphQLNonNull(UserNestedObjectListType)),
    },
    selfContact: {
      type: ContactType,
      resolve: (user: User, args: {}, context: RequestContext) => {
        return user.loadSelfContact();
      },
    },
    comments: {
      type: new GraphQLNonNull(UserToCommentsConnectionType()),
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
          (v, user: User) => UserToCommentsQuery.query(v, user),
          args,
        );
      },
    },
    createdEvents: {
      type: new GraphQLNonNull(UserToCreatedEventsConnectionType()),
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
      type: new GraphQLNonNull(UserToDeclinedEventsConnectionType()),
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
      type: new GraphQLNonNull(UserToEventsAttendingConnectionType()),
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
      type: new GraphQLNonNull(UserToFriendsConnectionType()),
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
      type: new GraphQLNonNull(UserToInvitedEventsConnectionType()),
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
    likers: {
      type: new GraphQLNonNull(UserToLikersConnectionType()),
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
          (v, user: User) => UserToLikersQuery.query(v, user),
          args,
        );
      },
    },
    likes: {
      type: new GraphQLNonNull(UserToLikesConnectionType()),
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
          (v, user: User) => UserToLikesQuery.query(v, user),
          args,
        );
      },
    },
    maybeEvents: {
      type: new GraphQLNonNull(UserToMaybeEventsConnectionType()),
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
      type: new GraphQLNonNull(UserToHostedEventsConnectionType()),
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
      type: new GraphQLNonNull(UserToContactsConnectionType()),
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
      type: new GraphQLNonNull(GraphQLString),
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
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(ContactType)),
      ),
      resolve: async (user: User, args: {}, context: RequestContext) => {
        return user.getContactsSameDomain();
      },
    },
    contactsSameDomainNullable: {
      type: new GraphQLList(new GraphQLNonNull(ContactType)),
      resolve: async (user: User, args: {}, context: RequestContext) => {
        return user.getContactsSameDomainNullable();
      },
    },
    contactsSameDomainNullableContents: {
      type: new GraphQLNonNull(new GraphQLList(ContactType)),
      resolve: async (user: User, args: {}, context: RequestContext) => {
        return user.getContactsSameDomainNullableContents();
      },
    },
    contactsSameDomainNullableContentsAndList: {
      type: new GraphQLList(ContactType),
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
