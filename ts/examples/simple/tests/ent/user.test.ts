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
  loadEdges,
  AssocEdge,
  AssocEdgeInput,
} from "ent/ent";
import DB from "ent/db";
import { LogedOutViewer } from "ent/viewer";

import { v4 as uuidv4 } from "uuid";
import { NodeType, EdgeType } from "src/ent/const";
import { createEvent } from "src/ent/event";
import { createUserFrom } from "src/ent/generated/user_base";

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
  let user = await create({ firstName: "Jon", lastName: "Snow" });
  let user2 = await create({
    firstName: "Daenerys",
    lastName: "Targaryen",
  });

  const input = {
    id1: user.id,
    id2: user2.id,
    edgeType: EdgeType.UserToFriends,
    id1Type: NodeType.User,
    id2Type: NodeType.User,
  };
  await writeEdge(input);

  const edges = await loadEdges(user.id, EdgeType.UserToFriends);
  expect(edges.length).toBe(1);
  verifyEdge(edges[0], input);

  const edges2 = await loadEdges(user2.id, EdgeType.UserToFriends);
  expect(edges2.length).toBe(1);
  verifyEdge(edges2[0], {
    id1: user2.id,
    id2: user.id,
    edgeType: EdgeType.UserToFriends,
    id1Type: NodeType.User,
    id2Type: NodeType.User,
  });
});

test("inverse edge", async () => {
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
    id1: event.id,
    id1Type: NodeType.Event,
    id2: user.id,
    id2Type: NodeType.User,
    edgeType: EdgeType.EventToInvited,
  };
  await writeEdge(input);

  const edges = await loadEdges(event.id, EdgeType.EventToInvited);
  expect(edges.length).toBe(1);
  verifyEdge(edges[0], input);

  const edges2 = await loadEdges(user.id, EdgeType.UserToInvitedEvents);
  expect(edges2.length).toBe(1);
  verifyEdge(edges2[0], {
    id1: user.id,
    id1Type: NodeType.User,
    id2: event.id,
    id2Type: NodeType.Event,
    edgeType: EdgeType.UserToInvitedEvents,
  });
});

test.only("one-way edge", async () => {
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

  const edges = await loadEdges(user.id, EdgeType.UserToCreatedEvents);
  expect(edges.length).toBe(1);
  verifyEdge(edges[0], input);
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
