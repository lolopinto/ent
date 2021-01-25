// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

export enum NodeType {
  // Address is the node type for the Address object. Used to identify this node in edges and other places.
  Address = "address",
  // Event is the node type for the Event object. Used to identify this node in edges and other places.
  Event = "event",
  // EventActivity is the node type for the EventActivity object. Used to identify this node in edges and other places.
  EventActivity = "eventActivity",
  // Guest is the node type for the Guest object. Used to identify this node in edges and other places.
  Guest = "guest",
  // GuestData is the node type for the GuestData object. Used to identify this node in edges and other places.
  GuestData = "guestData",
  // GuestGroup is the node type for the GuestGroup object. Used to identify this node in edges and other places.
  GuestGroup = "guestGroup",
  // User is the node type for the User object. Used to identify this node in edges and other places.
  User = "user",
}

export function getNodeTypeValues() {
  return [
    NodeType.Address,
    NodeType.Event,
    NodeType.EventActivity,
    NodeType.Guest,
    NodeType.GuestData,
    NodeType.GuestGroup,
    NodeType.User,
  ];
}

export enum EdgeType {
  // EventActivityToAttending is the edgeType for the eventActivity to attending edge.
  EventActivityToAttending = "8025c416-c0a9-42dd-9bf4-f97f283d31a2",
  // EventActivityToDeclined is the edgeType for the eventActivity to declined edge.
  EventActivityToDeclined = "f3ff6b74-c055-4562-b5dd-07e4e2d8c8e3",
  // EventActivityToInvites is the edgeType for the eventActivity to invites edge.
  EventActivityToInvites = "64ef93f6-7edf-42ce-a3e4-8c30d9851645",
  // GuestGroupToInvitedEvents is the edgeType for the guestGroup to guestgrouptoinvitedevents edge.
  GuestGroupToInvitedEvents = "759e4abe-f866-41b7-aae8-40be4e8ab21e",
  // GuestToAttendingEvents is the edgeType for the guest to guesttoattendingevents edge.
  GuestToAttendingEvents = "ea0de57e-25de-47ab-8ddc-324f41c892a3",
  // GuestToDeclinedEvents is the edgeType for the guest to guesttodeclinedevents edge.
  GuestToDeclinedEvents = "5798e422-75d3-42ac-9ef8-30bd35e34f9f",
}

export function getEdgeTypeValues() {
  return [
    EdgeType.EventActivityToAttending,
    EdgeType.EventActivityToDeclined,
    EdgeType.EventActivityToInvites,
    EdgeType.GuestGroupToInvitedEvents,
    EdgeType.GuestToAttendingEvents,
    EdgeType.GuestToDeclinedEvents,
  ];
}
