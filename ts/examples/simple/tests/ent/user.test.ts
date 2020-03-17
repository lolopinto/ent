import User, {
  createUser,
  editUser,
  deleteUser,
  UserCreateInput,
} from "src/ent/user";

import {
  ID,
  Ent,
  Viewer,
  writeEdge,
  AssocEdge,
  AssocEdgeInput,
  loadEnts,
} from "ent/ent";
import DB from "ent/db";
import { LogedOutViewer } from "ent/viewer";

import { v4 as uuidv4 } from "uuid";
import { NodeType, EdgeType } from "src/ent/const";
import Event, { createEvent } from "src/ent/event";

const loggedOutViewer = new LogedOutViewer();

// TODO we need something that does this by default for all tests
afterAll(async () => {
  await DB.getInstance().endPool();
});

async function create(input: UserCreateInput): Promise<User> {
  let user = await createUser(loggedOutViewer, input);
  if (user == null) {
    fail("could not create user");
  }
  return user;
}

test("create user", async () => {
  try {
    let user = await create({ firstName: "Jon", lastName: "Snow" });

    expect(user.firstName).toBe("Jon");
    expect(user.lastName).toBe("Snow");
  } catch (e) {
    fail(e.message);
  }
});

test("edit user", async () => {
  try {
    let user = await create({ firstName: "Jon", lastName: "Snow" });

    let editedUser = await editUser(loggedOutViewer, user.id, {
      firstName: "First of his name",
    });

    expect(editedUser).not.toBe(null);
    expect(editedUser?.firstName).toBe("First of his name");
    expect(editedUser?.lastName).toBe("Snow");
  } catch (e) {
    fail(e.message);
  }
});

test("delete user", async () => {
  try {
    let user = await create({ firstName: "Jon", lastName: "Snow" });

    await deleteUser(loggedOutViewer, user.id);

    let loadedUser = await User.load(loggedOutViewer, user.id);
    expect(loadedUser).toBe(null);
  } catch (e) {
    fail(e.message);
  }
});

class IDViewer implements Viewer {
  constructor(public viewerID: ID, private ent: Ent | null = null) {}
  async viewer() {
    return this.ent;
  }
  instanceKey(): string {
    return `idViewer: ${this.viewerID}`;
  }
}

class OmniViewer extends IDViewer {
  isOmniscient(): boolean {
    return true;
  }
}

describe("privacy", () => {
  test("load", async () => {
    let user = await create({ firstName: "Jon", lastName: "Snow" });
    let user2 = await create({
      firstName: "Daenerys",
      lastName: "Targaryen",
    });

    try {
      // we only do privacy checks when loading right now...
      let loadedUser = await User.load(new IDViewer(user.id, user), user.id);
      expect(loadedUser).toBeInstanceOf(User);
      expect(loadedUser).not.toBe(null);
      expect(loadedUser?.id).toBe(user.id);

      // privacy indicates other user cannot load
      let loadedUser2 = await User.load(new IDViewer(user2.id, user2), user.id);
      expect(loadedUser2).toBe(null);
    } catch (e) {
      fail(e.message);
    }
  });

  test("loadX", async () => {
    let user = await create({ firstName: "Jon", lastName: "Snow" });
    let user2 = await create({
      firstName: "Daenerys",
      lastName: "Targaryen",
    });

    try {
      // we only do privacy checks when loading right now...
      let loadedUser = await User.loadX(new IDViewer(user.id, user), user.id);
      expect(loadedUser).toBeInstanceOf(User);
      expect(loadedUser.id).toBe(user.id);
    } catch (e) {
      fail(e.message);
    }

    try {
      // privacy indicates other user cannot load
      await User.loadX(new IDViewer(user2.id, user2), user.id);
      fail("should have thrown exception");
    } catch (e) {}
  });
});

test("symmetric edge", async () => {
  let jon = await create({
    firstName: "Jon",
    lastName: "Snow",
  });
  let dany = await create({
    firstName: "Daenerys",
    lastName: "Targaryen",
  });
  let sam = await create({
    firstName: "Samwell",
    lastName: "Tarly",
  });

  const danyInput = {
    id1: jon.id,
    id2: dany.id,
    edgeType: EdgeType.UserToFriends,
    id1Type: NodeType.User,
    id2Type: NodeType.User,
  };
  await writeEdge(danyInput);
  let t = new Date();
  t.setTime(t.getTime() + 86400);
  const samInput = {
    id1: jon.id,
    id2: sam.id,
    edgeType: EdgeType.UserToFriends,
    id1Type: NodeType.User,
    id2Type: NodeType.User,
    time: t,
  };
  await writeEdge(samInput);

  const [edges, edgesCount, edges2, edges2Count] = await Promise.all([
    jon.loadFriendsEdges(),
    jon.loadFriendsRawCountX(),
    dany.loadFriendsEdges(),
    dany.loadFriendsRawCountX(),
  ]);
  expect(edges.length).toBe(2);

  expect(edgesCount).toBe(2);
  // sam is more recent, so dany should be [1]
  verifyEdge(edges[1], danyInput);

  const samEdge = await jon.loadFriendEdgeFor(sam.id);
  expect(samEdge).not.toBe(null);
  verifyEdge(samEdge!, samInput);

  expect(edges2.length).toBe(1);
  expect(edges2Count).toBe(1);
  verifyEdge(edges2[0], {
    id1: dany.id,
    id2: jon.id,
    edgeType: EdgeType.UserToFriends,
    id1Type: NodeType.User,
    id2Type: NodeType.User,
  });

  // logged out viewer here (because no privacy for creation yet)
  // even though can load raw edges above. can't load the nodes that you can't see privacy of
  const loadedUser = await User.load(jon.viewer, dany.id);
  expect(loadedUser).toBe(null);

  const friends = await jon.loadFriends();
  expect(friends.length).toBe(0);
});

test("inverse edge", async () => {
  let user = await create({
    firstName: "Jon",
    lastName: "Snow",
  });
  let event = await createEvent(new LogedOutViewer(), {
    creatorID: user.id as string,
    startTime: new Date(),
    name: "fun event",
    location: "location",
  });

  if (!event) {
    fail("could not create event");
  }

  const input = {
    id1: event.id,
    id1Type: NodeType.Event,
    id2: user.id,
    id2Type: NodeType.User,
    edgeType: EdgeType.EventToInvited,
  };
  await writeEdge(input);

  const [edges, edgesCount, edges2, edges2Count] = await Promise.all([
    event.loadInvitedEdges(),
    event.loadInvitedRawCountX(),
    user.loadInvitedEventsEdges(),
    user.loadInvitedEventsRawCountX(),
  ]);
  expect(edges.length).toBe(1);
  expect(edgesCount).toBe(1);
  verifyEdge(edges[0], input);

  expect(edges2.length).toBe(1);
  expect(edges2Count).toBe(1);
  verifyEdge(edges2[0], {
    id1: user.id,
    id1Type: NodeType.User,
    id2: event.id,
    id2Type: NodeType.Event,
    edgeType: EdgeType.UserToInvitedEvents,
  });

  // privacy of event is everyone can see so can load events at end of edge
  const v = new IDViewer(user.id);
  const loadedEvent = await Event.load(v, event.id);
  expect(loadedEvent).not.toBe(null);

  const invitedEvents = await user.loadInvitedEvents();
  expect(invitedEvents.length).toBe(1);
  expect(invitedEvents[0].id).toBe(loadedEvent?.id);
});

test("one-way edge", async () => {
  // todo this is a field edge that we'll get later
  let user = await create({ firstName: "Jon", lastName: "Snow" });
  let event = await createEvent(new LogedOutViewer(), {
    creatorID: user.id as string,
    startTime: new Date(),
    name: "fun event",
    location: "location",
  });

  if (!event) {
    fail("could not create event");
  }

  const input = {
    id1: user.id,
    id1Type: NodeType.User,
    id2: event.id,
    id2Type: NodeType.Event,
    edgeType: EdgeType.UserToCreatedEvents,
  };
  await writeEdge(input);

  const edges = await user.loadCreatedEventsEdges();
  expect(edges.length).toBe(1);
  verifyEdge(edges[0], input);
});

test("loadMultiUsers", async () => {
  let jon = await create({ firstName: "Jon", lastName: "Snow" });
  let dany = await create({
    firstName: "Daenerys",
    lastName: "Targaryen",
  });
  let sam = await create({ firstName: "Samwell", lastName: "Tarly" });

  const tests: [Viewer, number, string][] = [
    [loggedOutViewer, 0, "logged out viewer"],
    [new OmniViewer(jon.id), 3, "omni viewer"],
    [new IDViewer(jon.id), 1, "1 id"],
  ];

  for (const testData of tests) {
    const v = testData[0];
    const expectedCount = testData[1];
    const users = await loadEnts(
      v,
      User.loaderOptions(),
      jon.id,
      dany.id,
      sam.id,
    );

    expect(users.length, testData[2]).toBe(expectedCount);
  }
});

function verifyEdge(edge: AssocEdge, expectedEdge: AssocEdgeInput) {
  expect(edge.id1).toBe(expectedEdge.id1);
  expect(edge.id2).toBe(expectedEdge.id2);
  expect(edge.id1Type).toBe(expectedEdge.id1Type);
  expect(edge.id2Type).toBe(expectedEdge.id2Type);
  expect(edge.edgeType).toBe(expectedEdge.edgeType);
  expect(edge.data).toBe(expectedEdge.data || null);
}

test("loadX", async () => {
  try {
    await User.loadX(loggedOutViewer, uuidv4());
    fail("should have thrown exception");
  } catch (e) {}
});
