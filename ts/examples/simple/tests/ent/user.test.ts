import User, {
  createUser,
  editUser,
  deleteUser,
  UserCreateInput,
} from "src/ent/user";
import Contact, { createContact } from "src/ent/contact";

import {
  ID,
  Ent,
  Viewer,
  AssocEdge,
  AssocEdgeInput,
  writeEdgeX,
} from "ent/ent";
import DB from "ent/db";
import { LoggedOutViewer } from "ent/viewer";

import { v4 as uuidv4 } from "uuid";
import { NodeType, EdgeType } from "src/ent/const";
import Event, { createEvent } from "src/ent/event";
import { randomEmail } from "src/util/random";

const loggedOutViewer = new LoggedOutViewer();

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
    let user = await create({
      firstName: "Jon",
      lastName: "Snow",
      emailAddress: randomEmail(),
    });

    expect(user.firstName).toBe("Jon");
    expect(user.lastName).toBe("Snow");
  } catch (e) {
    fail(e.message);
  }
});

test("edit user", async () => {
  try {
    let user = await create({
      firstName: "Jon",
      lastName: "Snow",
      emailAddress: randomEmail(),
    });

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
    let user = await create({
      firstName: "Jon",
      lastName: "Snow",
      emailAddress: randomEmail(),
    });

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
    let user = await create({
      firstName: "Jon",
      lastName: "Snow",
      emailAddress: randomEmail(),
    });
    let user2 = await create({
      firstName: "Daenerys",
      lastName: "Targaryen",
      emailAddress: randomEmail(),
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
    let user = await create({
      firstName: "Jon",
      lastName: "Snow",
      emailAddress: randomEmail(),
    });
    let user2 = await create({
      firstName: "Daenerys",
      lastName: "Targaryen",
      emailAddress: randomEmail(),
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
    emailAddress: randomEmail(),
  });
  let dany = await create({
    firstName: "Daenerys",
    lastName: "Targaryen",
    emailAddress: randomEmail(),
  });
  let sam = await create({
    firstName: "Samwell",
    lastName: "Tarly",
    emailAddress: randomEmail(),
  });

  const danyInput = {
    id1: jon.id,
    id2: dany.id,
    edgeType: EdgeType.UserToFriends,
    id1Type: NodeType.User,
    id2Type: NodeType.User,
  };
  await writeEdgeX(danyInput);
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
  await writeEdgeX(samInput);

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
    emailAddress: randomEmail(),
  });
  let event = await createEvent(new LoggedOutViewer(), {
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
  await writeEdgeX(input);

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
  let user = await create({
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: randomEmail(),
  });
  let event = await createEvent(new LoggedOutViewer(), {
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
  await writeEdgeX(input);

  const edges = await user.loadCreatedEventsEdges();
  expect(edges.length).toBe(1);
  verifyEdge(edges[0], input);
});

test("loadMultiUsers", async () => {
  let jon = await create({
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: randomEmail(),
  });
  let dany = await create({
    firstName: "Daenerys",
    lastName: "Targaryen",
    emailAddress: randomEmail(),
  });
  let sam = await create({
    firstName: "Samwell",
    lastName: "Tarly",
    emailAddress: randomEmail(),
  });

  const tests: [Viewer, number, string][] = [
    [loggedOutViewer, 0, "logged out viewer"],
    [new OmniViewer(jon.id), 3, "omni viewer"],
    [new IDViewer(jon.id), 1, "1 id"],
  ];

  for (const testData of tests) {
    const v = testData[0];
    const expectedCount = testData[1];
    const users = await User.loadMany(v, jon.id, dany.id, sam.id);

    expect(users.length, testData[2]).toBe(expectedCount);

    for (const user of users) {
      // confirm they're the right type
      expect(user).toBeInstanceOf(User);
    }
  }
});

test("loadFromEmailAddress", async () => {
  const emailAddress = randomEmail();

  let jon = await create({
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: emailAddress,
  });

  const loggedOutJon = await User.loadFromEmailAddress(
    loggedOutViewer,
    emailAddress,
  );
  expect(loggedOutJon).toBe(null);

  const jonFromHimself = await User.loadFromEmailAddress(
    new IDViewer(jon.id),
    emailAddress,
  );
  expect(jonFromHimself).not.toBe(null);
  expect(jonFromHimself?.id).toBe(jon.id);
  expect(jonFromHimself).toBeInstanceOf(User);

  const mustJon = await User.loadFromEmailAddressX(
    new IDViewer(jon.id),
    emailAddress,
  );
  expect(mustJon.id).toBe(jon.id);
  expect(mustJon).toBeInstanceOf(User);

  const rawID = await User.loadIDFromEmailAddress(emailAddress);
  expect(rawID).toBe(jon.id);

  const rando = await User.loadIDFromEmailAddress(randomEmail());
  expect(rando).toBe(null);
});

function verifyEdge(edge: AssocEdge, expectedEdge: AssocEdgeInput) {
  expect(edge.id1).toBe(expectedEdge.id1);
  expect(edge.id2).toBe(expectedEdge.id2);
  expect(edge.id1Type).toBe(expectedEdge.id1Type);
  expect(edge.id2Type).toBe(expectedEdge.id2Type);
  expect(edge.edgeType).toBe(expectedEdge.edgeType);
  expect(edge.data).toBe(expectedEdge.data || null);
}

test("loadUniqueEdge|Node", async () => {
  let jon = await create({
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: randomEmail(),
  });
  let sansa = await create({
    firstName: "Sansa",
    lastName: "Stark",
    emailAddress: randomEmail(),
  });

  expect(jon).toBeInstanceOf(User);
  expect(sansa).toBeInstanceOf(User);

  // make them friends
  await writeEdgeX({
    id1: jon.id,
    id2: sansa.id,
    edgeType: EdgeType.UserToFriends,
    id1Type: NodeType.User,
    id2Type: NodeType.User,
  });

  let contact = await createContact(loggedOutViewer, {
    emailAddress: jon.emailAddress,
    firstName: jon.firstName,
    lastName: jon.lastName,
    userID: jon.id as string,
  });
  let contact2 = await createContact(loggedOutViewer, {
    emailAddress: sansa.emailAddress,
    firstName: sansa.firstName,
    lastName: sansa.lastName,
    userID: jon.id as string,
  });

  if (!contact || !contact2) {
    fail("couldn't create contacts");
  }

  expect(contact).toBeInstanceOf(Contact);

  const selfContactInput: AssocEdgeInput = {
    id1: jon.id,
    id2: contact.id,
    id1Type: NodeType.User,
    id2Type: NodeType.Contact,
    edgeType: EdgeType.UserToSelfContact,
  };
  await writeEdgeX(selfContactInput);
  // try and write unique edge again
  try {
    await writeEdgeX(selfContactInput);
    fail("should have throw an exception trying to write duplicate edge");
  } catch (e) {
    expect(e.message).toMatch(/duplicate key value violates unique constraint/);
  }

  const v = new IDViewer(jon.id);
  const jonFromHimself = await User.loadX(v, jon.id);
  const [jonContact, allContacts] = await Promise.all([
    jonFromHimself.loadSelfContact(),
    jonFromHimself.loadContacts(),
  ]);
  //  const jonContact = await jonFromHimself.loadSelfContact();
  expect(jonContact).not.toBe(null);
  expect(jonContact?.id).toBe(contact.id);
  expect(allContacts?.length).toBe(2);

  // sansa can load jon because friends but can't load his contact
  const v2 = new IDViewer(sansa.id);
  const jonFromSansa = await User.loadX(v2, jon.id);
  const jonContactFromSansa = await jonFromSansa.loadSelfContact();
  expect(jonContactFromSansa).toBe(null);

  const edge = await jonFromSansa.loadSelfContactEdge();
  expect(edge).not.toBe(null);
  verifyEdge(edge!, selfContactInput);
});

test("loadX", async () => {
  try {
    await User.loadX(loggedOutViewer, uuidv4());
    fail("should have thrown exception");
  } catch (e) {}
});
