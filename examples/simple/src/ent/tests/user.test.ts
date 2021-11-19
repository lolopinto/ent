import {
  Viewer,
  AssocEdge,
  AssocEdgeInput,
  IDViewer,
  LoggedOutViewer,
  DB,
} from "@snowtop/ent";
import {
  User,
  Contact,
  Event,
  DaysOff,
  PreferredShift,
  ArticleToCommentsQuery,
} from "..";

import { v1 as uuidv1, v4 as uuidv4, validate } from "uuid";
import { NodeType, EdgeType } from "../generated/const";
import { random, randomEmail, randomPhoneNumber } from "../../util/random";

import CreateUserAction, {
  UserCreateInput,
} from "../user/actions/create_user_action";
import EditUserAction from "../user/actions/edit_user_action";
import DeleteUserAction from "../user/actions/delete_user_action";
import CreateEventAction from "../event/actions/create_event_action";
import CreateContactAction from "../contact/actions/create_contact_action";
import { FakeLogger } from "@snowtop/ent/testutils/fake_log";
import { FakeComms, Mode } from "@snowtop/ent/testutils/fake_comms";
import EditEmailAddressAction from "../user/actions/edit_email_address_action";
import ConfirmEditEmailAddressAction from "../user/actions/confirm_edit_email_address_action";
import EditPhoneNumberAction from "../user/actions/edit_phone_number_action";
import ConfirmEditPhoneNumberAction from "../user/actions/confirm_edit_phone_number_action";
import CreateCommentAction from "../comment/actions/create_comment_action";
import { NotifType } from "../user_prefs";

const loggedOutViewer = new LoggedOutViewer();

// TODO we need something that does this by default for all tests
afterAll(async () => {
  await DB.getInstance().endPool();
  FakeLogger.clear();
  FakeComms.clear();
});

async function create(opts: Partial<UserCreateInput>): Promise<User> {
  let input: UserCreateInput = {
    firstName: "first",
    lastName: "last",
    emailAddress: randomEmail(),
    password: "pa$$w0rd",
    phoneNumber: randomPhoneNumber(),
    ...opts,
  };
  return await CreateUserAction.create(loggedOutViewer, input).saveX();
}

class OmniViewer extends IDViewer {
  isOmniscient(): boolean {
    return true;
  }
}

test("create user", async () => {
  let user = await create({
    firstName: "Jon",
    lastName: "Snow",
  });

  expect(user.firstName).toBe("Jon");
  expect(user.lastName).toBe("Snow");
  expect(user.accountStatus).toBe("UNVERIFIED");
  expect(user.emailVerified).toBeFalsy();

  // confirm contact was automatically created
  let v = new IDViewer(user.id);
  user = await User.loadX(v, user.id);
  let contacts = await user.queryContacts().queryEnts();
  expect(contacts.length).toBe(1);
  let contact = contacts[0];

  expect(contact.firstName).toBe("Jon");
  expect(contact.lastName).toBe("Snow");
  expect(contact.emailAddress).toBe(user.emailAddress);
  expect(contact.userID).toBe(user.id);

  // confirm contact was indicated as a self-contact
  let selfContact = await user.loadSelfContact();
  expect(selfContact).not.toBe(null);
  expect(selfContact?.id).toBe(contact.id);

  expect(FakeLogger.verifyLogs(2));
  expect(FakeLogger.contains(`ent User created with id ${user.id}`)).toBe(true);
  expect(FakeLogger.contains(`ent Contact created with id ${contact.id}`)).toBe(
    true,
  );
  FakeComms.verifySent(user.emailAddress, Mode.EMAIL, {
    subject: "Welcome, Jon!",
    body: "Hi Jon, thanks for joining fun app!",
  });
});

test("edit user", async () => {
  let user = await create({
    firstName: "Jon",
    lastName: "Snow",
  });

  try {
    await EditUserAction.create(loggedOutViewer, user, {
      firstName: "First of his name",
    }).saveX();
    fail("should have thrown exception");
  } catch (err) {
    expect((err as Error).message).toMatch(
      /Logged out Viewer does not have permission to edit User/,
    );
  }

  let vc = new IDViewer(user.id, { ent: user });
  let editedUser = await EditUserAction.create(vc, user, {
    firstName: "First of his name",
  }).saveX();

  expect(editedUser).not.toBe(null);
  expect(editedUser.firstName).toBe("First of his name");
  expect(editedUser.lastName).toBe("Snow");
});

test("edit user. saveXFromID", async () => {
  let user = await create({
    firstName: "Jon",
    lastName: "Snow",
  });

  let vc = new IDViewer(user.id, { ent: user });
  let editedUser = await EditUserAction.saveXFromID(vc, user.id, {
    firstName: "First of his name",
  });

  expect(editedUser.firstName).toBe("First of his name");
  expect(editedUser.lastName).toBe("Snow");
});

test("delete user", async () => {
  let user = await create({
    firstName: "Jon",
    lastName: "Snow",
  });

  try {
    await DeleteUserAction.create(loggedOutViewer, user).saveX();
    fail("should have thrown exception");
  } catch (err) {
    expect((err as Error).message).toMatch(
      /Logged out Viewer does not have permission to delete User/,
    );
  }
  let vc = new IDViewer(user.id, { ent: user });
  await DeleteUserAction.create(vc, user).saveX();

  let loadedUser = await User.load(vc, user.id);
  expect(loadedUser).toBe(null);
});

test("delete user. saveXFromID", async () => {
  let user = await create({
    firstName: "Jon",
    lastName: "Snow",
  });

  let vc = new IDViewer(user.id, { ent: user });
  await DeleteUserAction.saveXFromID(vc, user.id);

  let loadedUser = await User.load(vc, user.id);
  expect(loadedUser).toBe(null);
});

describe("privacy", () => {
  test("load", async () => {
    let user = await create({
      firstName: "Jon",
      lastName: "Snow",
    });
    let user2 = await create({
      firstName: "Daenerys",
      lastName: "Targaryen",
    });

    // we only do privacy checks when loading right now...
    let loadedUser = await User.load(
      new IDViewer(user.id, { ent: user }),
      user.id,
    );
    expect(loadedUser).toBeInstanceOf(User);
    expect(loadedUser).not.toBe(null);
    expect(loadedUser?.id).toBe(user.id);

    // privacy indicates other user cannot load
    let loadedUser2 = await User.load(
      new IDViewer(user2.id, { ent: user2 }),
      user.id,
    );
    expect(loadedUser2).toBe(null);
  });

  test("loadX", async () => {
    let user = await create({
      firstName: "Jon",
      lastName: "Snow",
    });
    let user2 = await create({
      firstName: "Daenerys",
      lastName: "Targaryen",
    });

    // we only do privacy checks when loading right now...
    let loadedUser = await User.loadX(
      new IDViewer(user.id, { ent: user }),
      user.id,
    );
    expect(loadedUser).toBeInstanceOf(User);
    expect(loadedUser.id).toBe(user.id);

    try {
      // privacy indicates other user cannot load
      await User.loadX(new IDViewer(user2.id, { ent: user2 }), user.id);
      fail("should have thrown exception");
    } catch (e) {}
  });
});

// TODO this test is finnicky
test("symmetric edge", async () => {
  let dany = await create({
    firstName: "Daenerys",
    lastName: "Targaryen",
  });
  let sam = await create({
    firstName: "Samwell",
    lastName: "Tarly",
  });

  let action = CreateUserAction.create(loggedOutViewer, {
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: randomEmail(),
    password: "passs",
    phoneNumber: randomPhoneNumber(),
  });
  let t = new Date();
  t.setTime(t.getTime() + 86400);
  action.builder.addFriend(dany).addFriendID(sam.id, {
    time: t,
  });
  const jon = await action.saveX();

  const [edges, edgesCount, edges2, edges2Count] = await Promise.all([
    jon.queryFriends().queryEdges(),
    jon.queryFriends().queryRawCount(),
    dany.queryFriends().queryEdges(),
    dany.queryFriends().queryRawCount(),
  ]);
  expect(edges.length).toBe(2);

  expect(edgesCount).toBe(2);
  // sam is more recent, so dany should be [1]
  verifyEdge(edges[1], {
    id1: jon.id,
    id2: dany.id,
    edgeType: EdgeType.UserToFriends,
    id1Type: NodeType.User,
    id2Type: NodeType.User,
  });

  const samEdge = await jon.queryFriends().queryID2(sam.id);
  expect(samEdge).not.toBe(null);
  verifyEdge(samEdge!, {
    id1: jon.id,
    id2: sam.id,
    edgeType: EdgeType.UserToFriends,
    id1Type: NodeType.User,
    id2Type: NodeType.User,
    time: t,
  });

  expect(edges2.length).toBe(1);
  expect(edges2Count).toBe(1);
  verifyEdge(edges2[0], {
    id1: dany.id,
    id2: jon.id,
    edgeType: EdgeType.UserToFriends,
    id1Type: NodeType.User,
    id2Type: NodeType.User,
  });

  // even though can load raw edges above. can't load the nodes that you can't see privacy of
  const loadedUser = await User.load(jon.viewer, dany.id);
  expect(loadedUser).toBeInstanceOf(User);

  // jon loading via self
  const friends = await jon.queryFriends().queryEnts();
  expect(friends.length).toBe(2);

  let vc = new IDViewer(jon.id, { ent: jon });
  // delete all the edges and let's confirm it works
  const action2 = EditUserAction.create(vc, jon, {});
  action2.builder.removeFriend(dany, sam);
  await action2.saveX();

  const [
    jonReloadedEdges,
    jonReloadedEdgesCount,
    danyReloadedEdges,
    danyReloadedEdgesCount,
    samReloadedEdgesCount,
  ] = await Promise.all([
    jon.queryFriends().queryEdges(),
    jon.queryFriends().queryRawCount(),
    dany.queryFriends().queryEdges(),
    dany.queryFriends().queryRawCount(),
    sam.queryFriends().queryRawCount(),
  ]);
  expect(jonReloadedEdges.length).toBe(0);
  expect(jonReloadedEdgesCount).toBe(0);
  expect(danyReloadedEdges.length).toBe(0);
  expect(danyReloadedEdgesCount).toBe(0);
  expect(samReloadedEdgesCount).toBe(0);
});

test("inverse edge", async () => {
  let user = await create({
    firstName: "Jon",
    lastName: "Snow",
  });
  const action = CreateEventAction.create(new LoggedOutViewer(), {
    creatorID: user.id,
    startTime: new Date(),
    name: "fun event",
    location: "location",
  });
  action.builder.addInvited(user);
  const event = await action.saveX();

  const [edges, edgesCount, edges2, edges2Count] = await Promise.all([
    event.queryInvited().queryEdges(),
    event.queryInvited().queryRawCount(),
    user.queryInvitedEvents().queryEdges(),
    user.queryInvitedEvents().queryRawCount(),
  ]);
  expect(edges.length).toBe(1);
  expect(edgesCount).toBe(1);
  verifyEdge(edges[0], {
    id1: event.id,
    id1Type: NodeType.Event,
    id2: user.id,
    id2Type: NodeType.User,
    edgeType: EdgeType.EventToInvited,
  });

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

  const invitedEvents = await user.queryInvitedEvents().queryEnts();
  expect(invitedEvents.length).toBe(1);
  expect(invitedEvents[0].id).toBe(loadedEvent?.id);
});

test("one-way + inverse edge", async () => {
  let user = await create({
    firstName: "Jon",
    lastName: "Snow",
  });
  const event = await CreateEventAction.create(new LoggedOutViewer(), {
    creatorID: user.id,
    startTime: new Date(),
    name: "fun event",
    location: "location",
  }).saveX();

  // setting the creator id field also sets edge from user -> created event
  // because of the configuration
  const edges = await user.queryCreatedEvents().queryEdges();
  expect(edges.length).toBe(1);
  verifyEdge(edges[0], {
    id1: user.id,
    id1Type: NodeType.User,
    id2: event.id,
    id2Type: NodeType.Event,
    edgeType: EdgeType.UserToCreatedEvents,
  });
});

test("loadMultiUsers", async () => {
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

  const data = await User.loadRawDataFromEmailAddress(emailAddress);
  expect(data).toMatchObject({
    first_name: "Jon",
    last_name: "Snow",
    email_address: emailAddress,
  });

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
  expect(rando).toBe(undefined);
});

test("uniqueEdge|Node", async () => {
  // self contact also set at creation
  let jon = await create({
    firstName: "Jon",
    lastName: "Snow",
  });

  let action = CreateUserAction.create(loggedOutViewer, {
    firstName: "Sansa",
    lastName: "Stark",
    emailAddress: randomEmail(),
    phoneNumber: randomPhoneNumber(),
    password: "pa$$w0rd",
  });
  // make them friends
  action.builder.addFriend(jon);
  const sansa = await action.saveX();

  expect(jon).toBeInstanceOf(User);
  expect(sansa).toBeInstanceOf(User);

  let vc = new IDViewer(jon.id, { ent: jon });
  jon = await User.loadX(vc, jon.id);

  // jon was created as his own contact
  let contacts = await jon.queryContacts().queryEnts();
  expect(contacts.length).toBe(1);
  let contact = contacts[0];

  let contact2 = await CreateContactAction.create(new IDViewer(jon.id), {
    emailAddress: sansa.emailAddress,
    firstName: sansa.firstName,
    lastName: sansa.lastName,
    userID: jon.id,
  }).saveX();

  expect(contact2).toBeInstanceOf(Contact);

  let editAction = EditUserAction.create(vc, jon, {});
  // TODO throw at trying to mutate a build after saving. will help with a bunch of typos...
  editAction.builder.addSelfContact(contact);
  await editAction.saveX();

  try {
    // try and write another contact
    let editAction = EditUserAction.create(vc, jon, {});
    editAction.builder.addSelfContact(contact2);
    await editAction.saveX();

    fail("should have throw an exception trying to write duplicate edge");
  } catch (e) {
    expect((e as Error).message).toMatch(
      /duplicate key value violates unique constraint/,
    );
  }

  const v = new IDViewer(jon.id);
  const jonFromHimself = await User.loadX(v, jon.id);
  const [jonContact, allContacts] = await Promise.all([
    jonFromHimself.loadSelfContact(),
    jonFromHimself.queryContacts().queryEnts(),
  ]);
  expect(jonContact).not.toBe(null);
  expect(jonContact?.id).toBe(contact.id);
  expect(allContacts.length).toBe(2);

  // sansa can load jon because friends but can't load his contact
  const v2 = new IDViewer(sansa.id);
  const jonFromSansa = await User.loadX(v2, jon.id);
  const jonContactFromSansa = await jonFromSansa.loadSelfContact();
  expect(jonContactFromSansa).toBe(null);

  const edge = await jonFromSansa.loadSelfContactEdge();
  expect(edge).not.toBe(null);
  verifyEdge(edge!, {
    id1: jon.id,
    id2: contact.id,
    id1Type: NodeType.User,
    id2Type: NodeType.Contact,
    edgeType: EdgeType.UserToSelfContact,
  });
});

test("loadX", async () => {
  try {
    await User.loadX(loggedOutViewer, uuidv4());
    fail("should have thrown exception");
  } catch (e) {}
});

function verifyEdge(edge: AssocEdge, expectedEdge: AssocEdgeInput) {
  expect(edge.id1).toBe(expectedEdge.id1);
  expect(edge.id2).toBe(expectedEdge.id2);
  expect(edge.id1Type).toBe(expectedEdge.id1Type);
  expect(edge.id2Type).toBe(expectedEdge.id2Type);
  expect(edge.edgeType).toBe(expectedEdge.edgeType);
  expect(edge.data).toBe(expectedEdge.data || null);
}

describe("edit email", () => {
  test("existing user email", async () => {
    let user = await create({
      firstName: "Jon",
      lastName: "Snow",
      emailAddress: randomEmail(),
    });
    let user2 = await create({
      firstName: "Jon",
      lastName: "Snow",
      emailAddress: randomEmail(),
    });
    let vc = new IDViewer(user.id);

    try {
      await EditEmailAddressAction.create(vc, user, {
        newEmail: user2.emailAddress,
      }).saveX();
      fail("should have thrown");
    } catch (e) {
      expect((e as Error).message).toMatch(/^cannot change email/);
    }
  });

  async function createUserAndSendEmail() {
    const email = randomEmail();

    let user = await create({
      firstName: "Jon",
      lastName: "Snow",
      emailAddress: email,
    });
    let vc = new IDViewer(user.id);

    const newEmail = randomEmail();

    user = await EditEmailAddressAction.create(vc, user, {
      newEmail: newEmail,
    }).saveX();

    const authCodes = await user.queryAuthCodes().queryEdges();
    // TODO need to verify right code
    expect(authCodes.length).toEqual(1);
    const comms = FakeComms.getSent(newEmail, Mode.EMAIL);
    expect(comms.length).toBe(1);

    // confirm email wasn't saved.
    expect(user.emailAddress).toEqual(email);

    const url = new URL(comms[0].body);
    const code = url.searchParams.get("code");
    expect(code).toBeDefined();

    return { user, newEmail, code };
  }

  test("change email address", async () => {
    let { user, newEmail, code } = await createUserAndSendEmail();

    user = await ConfirmEditEmailAddressAction.create(user.viewer, user, {
      emailAddress: newEmail,
      code: code!,
    }).saveX();
    // saved now
    expect(user.emailAddress).toEqual(newEmail);

    //should have been deleted now
    const count = await user.queryAuthCodes().queryRawCount();
    expect(count).toEqual(0);
  });

  test("invalid code confirmed", async () => {
    let { user, newEmail, code } = await createUserAndSendEmail();

    try {
      await ConfirmEditEmailAddressAction.create(user.viewer, user, {
        emailAddress: newEmail,
        code: code + "1",
      }).saveX();
      fail("should have thrown");
    } catch (e) {
      expect((e as Error).message).toMatch(
        /code (\d+) not found associated with user/,
      );
    }
  });

  test("invalid email address confirmed", async () => {
    let { user, code } = await createUserAndSendEmail();

    try {
      await ConfirmEditEmailAddressAction.create(user.viewer, user, {
        emailAddress: randomEmail(),
        code: code!,
      }).saveX();
      fail("should have thrown");
    } catch (e) {
      expect((e as Error).message).toMatch(
        /code (\d+) not found associated with user/,
      );
    }
  });
});

describe("edit phone number", () => {
  test("existing user phone number", async () => {
    let user = await create({
      firstName: "Jon",
      lastName: "Snow",
      emailAddress: randomEmail(),
      phoneNumber: randomPhoneNumber(),
    });
    let user2 = await create({
      firstName: "Jon",
      lastName: "Snow",
      emailAddress: randomEmail(),
      phoneNumber: randomPhoneNumber(),
    });
    let vc = new IDViewer(user.id);

    try {
      await EditPhoneNumberAction.create(vc, user, {
        newPhoneNumber: user2.phoneNumber!,
      }).saveX();
      fail("should have thrown");
    } catch (e) {
      expect((e as Error).message).toMatch(/^cannot change phoneNumber/);
    }
  });

  async function createUserAndSendSMS() {
    const phone = randomPhoneNumber();

    let user = await create({
      firstName: "Jon",
      lastName: "Snow",
      emailAddress: randomEmail(),
      phoneNumber: phone,
    });
    let vc = new IDViewer(user.id);

    const newPhoneNumber = randomPhoneNumber();

    user = await EditPhoneNumberAction.create(vc, user, {
      newPhoneNumber: newPhoneNumber,
    }).saveX();

    const authCodes = await user.queryAuthCodes().queryEdges();
    // TODO need to verify right code
    expect(authCodes.length).toEqual(1);
    const comms = FakeComms.getSent(newPhoneNumber, Mode.SMS);
    expect(comms.length).toBe(1);

    // confirm phone wasn't saved.
    expect(user.phoneNumber).toEqual(phone);

    const body = comms[0].body;
    const r = new RegExp(/your new code is (\d+)/);
    const match = r.exec(body);
    const code = match![1];

    expect(code).toBeDefined();

    return { user, newPhoneNumber, code };
  }

  test("change phone number", async () => {
    let { user, newPhoneNumber, code } = await createUserAndSendSMS();

    user = await ConfirmEditPhoneNumberAction.create(user.viewer, user, {
      phoneNumber: newPhoneNumber,
      code: code!,
    }).saveX();
    // saved now
    expect(user.phoneNumber).toEqual(newPhoneNumber);

    //should have been deleted now
    const count = await user.queryAuthCodes().queryRawCount();
    expect(count).toEqual(0);
  });

  test("invalid code confirmed", async () => {
    let { user, newPhoneNumber, code } = await createUserAndSendSMS();

    try {
      await ConfirmEditPhoneNumberAction.create(user.viewer, user, {
        phoneNumber: newPhoneNumber,
        code: code + "1",
      }).saveX();
      fail("should have thrown");
    } catch (e) {
      expect((e as Error).message).toMatch(
        /code (\d+) not found associated with user/,
      );
    }
  });

  test("invalid phone number confirmed", async () => {
    let { user, code } = await createUserAndSendSMS();

    try {
      await ConfirmEditPhoneNumberAction.create(user.viewer, user, {
        phoneNumber: randomPhoneNumber(),
        code: code!,
      }).saveX();
      fail("should have thrown");
    } catch (e) {
      expect((e as Error).message).toMatch(
        /code (\d+) not found associated with user/,
      );
    }
  });
});

test("nicknames", async () => {
  const n = ["Lord Snow", "The Prince That was Promised"];

  let user = await create({
    firstName: "Jon",
    lastName: "Snow",
    nicknames: n,
  });

  expect(user.nicknames).toEqual(n);
});

test("likes", async () => {
  const [user1, user2] = await Promise.all([create({}), create({})]);
  const action = EditUserAction.create(user1.viewer, user1, {});
  action.builder.addLiker(user2);
  // for privacy
  action.builder.addFriend(user2);
  await action.saveX();

  const likersQuery = user1.queryLikers();
  const [count, ents] = await Promise.all([
    likersQuery.queryCount(),
    likersQuery.queryEnts(),
  ]);
  expect(count).toBe(1);
  expect(ents.length).toBe(1);
  expect(ents[0].id).toBe(user2.id);

  const likesQuery = user2.queryLikes();
  const [count2, ents2] = await Promise.all([
    likesQuery.queryCount(),
    likesQuery.queryEnts(),
  ]);
  expect(count2).toBe(1);
  expect(ents2.length).toBe(1);
  expect(ents2[0].id).toBe(user1.id);
});

test("comments", async () => {
  const [user1, user2] = await Promise.all([create({}), create({})]);

  const comment = await CreateCommentAction.create(user2.viewer, {
    authorID: user2.id,
    body: "sup",
    articleID: user1.id,
    articleType: user1.nodeType,
  }).saveX();

  const action = EditUserAction.create(user1.viewer, user1, {});
  // privacy
  action.builder.addFriend(user2);
  await action.saveX();

  const commentsQuery = user1.queryComments();
  const articleToCommentsQuery = ArticleToCommentsQuery.query(
    user1.viewer,
    user1,
  );

  const [
    userToCommentsCount,
    userToCommentsEnt,
    articleToCommentsCount,
    articleToCommentsEnt,
  ] = await Promise.all([
    commentsQuery.queryCount(),
    commentsQuery.queryEnts(),
    articleToCommentsQuery.queryCount(),
    articleToCommentsQuery.queryEnts(),
  ]);
  expect(userToCommentsCount).toBe(1);
  expect(articleToCommentsCount).toBe(1);
  expect(userToCommentsEnt.length).toBe(1);
  expect(userToCommentsEnt[0].id).toBe(comment.id);
  expect(userToCommentsEnt).toStrictEqual(articleToCommentsEnt);

  const postQuery = comment.queryPost();
  const [count2, ents2] = await Promise.all([
    postQuery.queryCount(),
    postQuery.queryEnts(),
  ]);
  expect(count2).toBe(1);
  expect(ents2.length).toBe(1);
  expect(ents2[0].id).toBe(user1.id);
});

test("jsonb types", async () => {
  const user = await CreateUserAction.create(new LoggedOutViewer(), {
    firstName: "Jane",
    lastName: "Doe",
    emailAddress: randomEmail(),
    phoneNumber: randomPhoneNumber(),
    password: random(),
    prefs: {
      finishedNux: true,
      notifTypes: [NotifType.EMAIL],
    },
    prefsList: [
      {
        finishedNux: true,
        notifTypes: [NotifType.EMAIL],
      },
      {
        finishedNux: false,
        notifTypes: [NotifType.MOBILE],
      },
    ],
  }).saveX();
  expect(user.prefs).toStrictEqual({
    finishedNux: true,
    notifTypes: [NotifType.EMAIL],
  });
  expect(user.prefsList).toStrictEqual([
    {
      finishedNux: true,
      notifTypes: [NotifType.EMAIL],
    },
    {
      finishedNux: false,
      notifTypes: [NotifType.MOBILE],
    },
  ]);
});

test("json type", async () => {
  const user = await CreateUserAction.create(new LoggedOutViewer(), {
    firstName: "Jane",
    lastName: "Doe",
    emailAddress: randomEmail(),
    phoneNumber: randomPhoneNumber(),
    password: random(),
    prefsDiff: {
      finishedNux: true,
      type: "finished_nux",
    },
  }).saveX();
  expect(user.prefsDiff).toStrictEqual({
    finishedNux: true,
    type: "finished_nux",
  });
});

test("json type fail", async () => {
  try {
    await CreateUserAction.create(new LoggedOutViewer(), {
      firstName: "Jane",
      lastName: "Doe",
      emailAddress: randomEmail(),
      phoneNumber: randomPhoneNumber(),
      password: random(),
      prefsDiff: {
        finishedNux: true,
      },
    }).saveX();
    fail("should throw");
  } catch (err) {
    expect((err as Error).message).toMatch(
      /invalid field prefs_diff with value/,
    );
  }
});

test("enum list", async () => {
  const user = await CreateUserAction.create(new LoggedOutViewer(), {
    firstName: "Jane",
    lastName: "Doe",
    emailAddress: randomEmail(),
    phoneNumber: randomPhoneNumber(),
    password: random(),
    daysOff: [DaysOff.Saturday, DaysOff.Sunday],
    preferredShift: [PreferredShift.Afternoon],
  }).saveX();
  expect(user.daysOff).toEqual([DaysOff.Saturday, DaysOff.Sunday]);
  expect(user.preferredShift).toEqual([PreferredShift.Afternoon]);
});

test("misc", async () => {
  const user = await CreateUserAction.create(new LoggedOutViewer(), {
    firstName: "Jane",
    lastName: "Doe",
    emailAddress: randomEmail(),
    phoneNumber: randomPhoneNumber(),
    password: random(),
    funUuids: [uuidv4(), uuidv1()],
  }).saveX();
  expect(typeof user.timeInMs).toBe("bigint");
  expect(user.funUuids?.length).toBe(2);
  expect(user.funUuids?.every((v) => validate(v.toString()))).toBe(true);
});
