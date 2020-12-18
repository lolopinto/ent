export enum EdgeType {
  UserToContacts = "userToContacts",
  UserToFriends = "userToFriends",

  UserToEventsAttending = "userToEventsAttending",
  EventToAttendees = "eventToAttendees",

  // we may need the inverse edge of these 3 later
  EventToInvited = "eventToInvited",
  EventToDeclined = "eventToDeclined",
  EventToMaybe = "eventToMaybe",

  EventToHosts = "eventToHosts",
  UserToHostedEvents = "userToHostedEvents",
}

export enum NodeType {
  FakeUser = "user",
  FakeContact = "contact",
  FakeEvent = "event",
}

export const SymmetricEdges = new Set();
SymmetricEdges.add(EdgeType.UserToFriends);

export const InverseEdges = new Map<EdgeType, EdgeType>([
  [EdgeType.UserToEventsAttending, EdgeType.EventToAttendees],
  [EdgeType.EventToAttendees, EdgeType.UserToEventsAttending],

  [EdgeType.UserToHostedEvents, EdgeType.EventToHosts],
  [EdgeType.EventToHosts, EdgeType.UserToHostedEvents],
]);
