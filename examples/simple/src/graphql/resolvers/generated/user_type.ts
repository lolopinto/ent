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
import { GraphQLJSON } from "graphql-type-json";
import { RequestContext } from "@snowtop/ent";
import {
  GraphQLEdgeConnection,
  GraphQLNodeInterface,
  convertToGQLEnum,
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
  getDaysOffValues,
  getPreferredShiftValues,
} from "../../../ent";
import {
  ContactType,
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
  daysOffType,
  preferredShiftType,
} from "../internal";

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
    prefs: {
      type: GraphQLJSON,
    },
    prefsDiff: {
      type: GraphQLJSON,
    },
    daysOff: {
      type: GraphQLList(GraphQLNonNull(daysOffType)),
      resolve: (user: User, args: {}, context: RequestContext) => {
        const ret = user.daysOff;
        return ret?.map((v) =>
          convertToGQLEnum(v, getDaysOffValues(), daysOffType.getValues()),
        );
      },
    },
    preferredShift: {
      type: GraphQLList(GraphQLNonNull(preferredShiftType)),
      resolve: (user: User, args: {}, context: RequestContext) => {
        const ret = user.preferredShift;
        return ret?.map((v) =>
          convertToGQLEnum(
            v,
            getPreferredShiftValues(),
            preferredShiftType.getValues(),
          ),
        );
      },
    },
    timeInMs: {
      type: GraphQLString,
    },
    funUuids: {
      type: GraphQLList(GraphQLNonNull(GraphQLID)),
    },
    newCol: {
      type: GraphQLString,
    },
    selfContact: {
      type: ContactType,
      resolve: (user: User, args: {}, context: RequestContext) => {
        return user.loadSelfContact();
      },
    },
    comments: {
      type: GraphQLNonNull(UserToCommentsConnectionType()),
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
    likers: {
      type: GraphQLNonNull(UserToLikersConnectionType()),
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
      type: GraphQLNonNull(UserToLikesConnectionType()),
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
