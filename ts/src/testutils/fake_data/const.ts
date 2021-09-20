import { Ent, LoadEntOptions } from "../../core/base";
import { FakeContact, FakeEvent, FakeUser } from "./internal";

export enum EdgeType {
  UserToContacts = "userToContacts",
  UserToFriends = "userToFriends",
  UserToCustomEdge = "userToCustomEdge",

  UserToEventsAttending = "userToEventsAttending",
  EventToAttendees = "eventToAttendees",

  // we may need the inverse edge of these 3 later
  EventToInvited = "eventToInvited",
  EventToDeclined = "eventToDeclined",
  EventToMaybe = "eventToMaybe",

  EventToHosts = "eventToHosts",
  UserToHostedEvents = "userToHostedEvents",

  UserToFriendRequests = "userToFriendRequests",
  UserToIncomingFriendRequests = "userToIncomingFriendRequests",

  // can follow users or events...
  // so a polymorphic edge
  UserToFollowing = "userToFollowing",
  ObjectToFollowedUsers = "objectToFollowedUsers",
}

export enum NodeType {
  FakeUser = "user",
  FakeContact = "contact",
  FakeEvent = "event",
}

export const SymmetricEdges = new Set<string>();
SymmetricEdges.add(EdgeType.UserToFriends);

export const InverseEdges = new Map<EdgeType, EdgeType>([
  [EdgeType.UserToEventsAttending, EdgeType.EventToAttendees],
  [EdgeType.EventToAttendees, EdgeType.UserToEventsAttending],

  [EdgeType.UserToHostedEvents, EdgeType.EventToHosts],
  [EdgeType.EventToHosts, EdgeType.UserToHostedEvents],

  [EdgeType.UserToFriendRequests, EdgeType.UserToIncomingFriendRequests],
  [EdgeType.UserToIncomingFriendRequests, EdgeType.UserToFriendRequests],

  [EdgeType.UserToFollowing, EdgeType.ObjectToFollowedUsers],
  [EdgeType.ObjectToFollowedUsers, EdgeType.UserToFollowing],
]);

export function getLoaderOptions(type: NodeType): LoadEntOptions<Ent> {
  switch (type) {
    case NodeType.FakeContact:
      return FakeContact.loaderOptions();
    case NodeType.FakeUser:
      return FakeUser.loaderOptions();
    case NodeType.FakeEvent:
      return FakeEvent.loaderOptions();
  }
}
