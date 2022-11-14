import { AssocEdge, AssocEdgeInput, setLogLevels } from "@snowtop/ent";
import { MockLogs } from "@snowtop/ent/testutils/mock_log";
import { TestContext } from "@snowtop/ent/testutils/context/test_context";
import { User, Contact, Event, ArticleToCommentsQuery } from "..";
import {
  UserDaysOff,
  UserPreferredShift,
  IntEnumUsedInList,
  UserIntEnum,
  NotifType,
  NotifType2,
  EnumUsedInList,
  UserNestedObjectList,
  CatBreed,
  DogBreed,
  DogBreedGroup,
  NestedObjNestedNestedEnum,
  ObjNestedEnum,
  RabbitBreed,
  SuperNestedObjectEnum,
  UserSuperNestedObject,
} from "../generated/types";
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
import DeleteUserAction2 from "../user/actions/delete_user_action_2";
import { LoggedOutExampleViewer, ExampleViewer } from "../../viewer/viewer";
import EditUserAllFieldsAction from "../user/actions/edit_user_all_fields_action";

const loggedOutViewer = new LoggedOutExampleViewer();

afterAll(async () => {
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

class OmniViewer extends ExampleViewer {
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
  expect(await user.accountStatus()).toBe("UNVERIFIED");
  expect(await user.emailVerified()).toBeFalsy();

  // confirm contact was automatically created
  let v = new ExampleViewer(user.id);
  user = await User.loadX(v, user.id);
  let contacts = await user.queryContacts().queryEnts();
  expect(contacts.length).toBe(1);
  let contact = contacts[0];
  // TODO load emails and verify
  //  contact.queryContactEmails().que

  expect(contact.firstName).toBe("Jon");
  expect(contact.lastName).toBe("Snow");
  //  expect(contact.emailAddress).toBe(user.emailAddress);
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

test("create user with accountstatus", async () => {
  let user = await create({
    firstName: "Jon",
    lastName: "Snow",
    accountStatus: "VERIFIED",
  });

  expect(user.firstName).toBe("Jon");
  expect(user.lastName).toBe("Snow");
  expect(await user.accountStatus()).toBe("VERIFIED");
});

test("create user with accountstatus explicitly null", async () => {
  let user = await create({
    firstName: "Jon",
    lastName: "Snow",
    accountStatus: null,
  });

  expect(user.firstName).toBe("Jon");
  expect(user.lastName).toBe("Snow");
  expect(await user.accountStatus()).toBe("UNVERIFIED");
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
    throw new Error("should have thrown exception");
  } catch (err) {
    expect((err as Error).message).toMatch(
      /Logged out Viewer does not have permission to edit User/,
    );
  }

  let vc = new ExampleViewer(user.id);
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

  let vc = new ExampleViewer(user.id);
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
    throw new Error("should have thrown exception");
  } catch (err) {
    expect((err as Error).message).toMatch(
      /Logged out Viewer does not have permission to delete User/,
    );
  }
  let vc = new ExampleViewer(user.id);
  await DeleteUserAction.create(vc, user).saveX();

  let loadedUser = await User.load(vc, user.id);
  expect(loadedUser).toBe(null);
});

test("delete user 2", async () => {
  let user = await create({
    firstName: "Jon",
    lastName: "Snow",
  });

  try {
    await DeleteUserAction2.create(loggedOutViewer, user, {
      log: true,
    }).saveX();
    throw new Error("should have thrown exception");
  } catch (err) {
    expect((err as Error).message).toMatch(
      /Logged out Viewer does not have permission to delete User/,
    );
  }
  let vc = new ExampleViewer(user.id);
  await DeleteUserAction2.create(vc, user, { log: true }).saveX();

  let loadedUser = await User.load(vc, user.id);
  expect(loadedUser).toBe(null);
});

test("delete user. saveXFromID", async () => {
  let user = await create({
    firstName: "Jon",
    lastName: "Snow",
  });

  let vc = new ExampleViewer(user.id);
  await DeleteUserAction.saveXFromID(vc, user.id);

  let loadedUser = await User.load(vc, user.id);
  expect(loadedUser).toBe(null);
});

test("delete user 2. saveXFromID", async () => {
  let user = await create({
    firstName: "Jon",
    lastName: "Snow",
  });

  let vc = new ExampleViewer(user.id);
  await DeleteUserAction2.saveXFromID(vc, user.id, { log: true });

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
    let loadedUser = await User.load(new ExampleViewer(user.id), user.id);
    expect(loadedUser).toBeInstanceOf(User);
    expect(loadedUser).not.toBe(null);
    expect(loadedUser?.id).toBe(user.id);

    // privacy indicates other user cannot load
    let loadedUser2 = await User.load(new ExampleViewer(user2.id), user.id);
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

    let loadedUser = await User.loadX(new ExampleViewer(user.id), user.id);
    expect(loadedUser).toBeInstanceOf(User);
    expect(loadedUser.id).toBe(user.id);

    try {
      // privacy indicates other user cannot load
      await User.loadX(new ExampleViewer(user2.id), user.id);
      throw new Error("should have thrown exception");
    } catch (e) {}
  });

  test("field privacy", async () => {
    let user1 = await create({
      firstName: "Jon",
      lastName: "Snow",
    });
    expect(await user1.accountStatus()).toBe("UNVERIFIED");
    let user2 = await create({
      firstName: "Daenerys",
      lastName: "Targaryen",
    });
    expect(await user2.accountStatus()).toBe("UNVERIFIED");

    // can't see user when not friends
    expect(await User.load(user2.viewer, user1.id)).toBe(null);

    const action = EditUserAction.create(user1.viewer, user1, {});
    // for privacy
    action.builder.addFriend(user2);
    await action.saveX();

    // can see users because friends but doesn't mean you can see their account status since privacy is set to just self
    const fromUser2 = await User.loadX(user2.viewer, user1.id);
    expect(await fromUser2.accountStatus()).toBe(null);
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

  let vc = new ExampleViewer(jon.id);
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
  const action = CreateEventAction.create(new LoggedOutExampleViewer(), {
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
  const v = new ExampleViewer(user.id);
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
  const event = await CreateEventAction.create(new LoggedOutExampleViewer(), {
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

  const tests: [ExampleViewer, number, string][] = [
    [loggedOutViewer, 0, "logged out viewer"],
    [new OmniViewer(jon.id), 3, "omni viewer"],
    [new ExampleViewer(jon.id), 1, "1 id"],
  ];

  for (const testData of tests) {
    const v = testData[0];
    const expectedCount = testData[1];
    const users = await User.loadMany(v, jon.id, dany.id, sam.id);

    expect(users.size, testData[2]).toBe(expectedCount);

    for (const [_id, user] of users) {
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
    new ExampleViewer(jon.id),
    emailAddress,
  );
  expect(jonFromHimself).not.toBe(null);
  expect(jonFromHimself?.id).toBe(jon.id);
  expect(jonFromHimself).toBeInstanceOf(User);

  const mustJon = await User.loadFromEmailAddressX(
    new ExampleViewer(jon.id),
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

  let vc = new ExampleViewer(jon.id);
  jon = await User.loadX(vc, jon.id);

  // jon was created as his own contact
  let contacts = await jon.queryContacts().queryEnts();
  expect(contacts.length).toBe(1);
  let contact = contacts[0];

  let contact2 = await CreateContactAction.create(new ExampleViewer(jon.id), {
    emails: [
      {
        emailAddress: sansa.emailAddress,
        label: "main",
      },
    ],
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

    throw new Error(
      "should have throw an exception trying to write duplicate edge",
    );
  } catch (e) {
    expect((e as Error).message).toMatch(
      /duplicate key value violates unique constraint/,
    );
  }

  const v = new ExampleViewer(jon.id);
  const jonFromHimself = await User.loadX(v, jon.id);
  const [jonContact, allContacts] = await Promise.all([
    jonFromHimself.loadSelfContact(),
    jonFromHimself.queryContacts().queryEnts(),
  ]);
  expect(jonContact).not.toBe(null);
  expect(jonContact?.id).toBe(contact.id);
  expect(allContacts.length).toBe(2);

  // sansa can load jon because friends but can't load his contact
  const v2 = new ExampleViewer(sansa.id);
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
    throw new Error("should have thrown exception");
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
    let vc = new ExampleViewer(user.id);

    try {
      await EditEmailAddressAction.create(vc, user, {
        newEmail: user2.emailAddress,
      }).saveX();
      throw new Error("should have thrown");
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
    let vc = new ExampleViewer(user.id);

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
      throw new Error("should have thrown");
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
      throw new Error("should have thrown");
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
    let vc = new ExampleViewer(user.id);

    try {
      await EditPhoneNumberAction.create(vc, user, {
        newPhoneNumber: user2.phoneNumber!,
      }).saveX();
      throw new Error("should have thrown");
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
    let vc = new ExampleViewer(user.id);

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
      throw new Error("should have thrown");
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
      throw new Error("should have thrown");
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

  const author = await comment.loadAuthorX();
  expect(author.id).toBe(user2.id);

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
  const user = await CreateUserAction.create(new LoggedOutExampleViewer(), {
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
        notifTypes: [NotifType2.EMAIL],
      },
      {
        finishedNux: false,
        notifTypes: [NotifType2.MOBILE],
      },
    ],
  }).saveX();
  expect(await user.prefs()).toStrictEqual({
    enableNotifs: undefined,
    finishedNux: true,
    notifTypes: [NotifType.EMAIL],
  });
  expect(await user.prefsList()).toStrictEqual([
    {
      enableNotifs: undefined,
      finishedNux: true,
      notifTypes: [NotifType.EMAIL],
    },
    {
      enableNotifs: undefined,
      finishedNux: false,
      notifTypes: [NotifType.MOBILE],
    },
  ]);
});

test("json type", async () => {
  const user = await CreateUserAction.create(new LoggedOutExampleViewer(), {
    firstName: "Jane",
    lastName: "Doe",
    emailAddress: randomEmail(),
    phoneNumber: randomPhoneNumber(),
    password: random(),
    prefsDiff: {
      type: "finished_nux",
    },
  }).saveX();
  expect(await user.prefsDiff()).toStrictEqual({
    type: "finished_nux",
  });
});

describe("super nested complex", () => {
  test("super nested", async () => {
    const obj: UserSuperNestedObject = {
      uuid: uuidv1(),
      int: 34,
      string: "whaa",
      float: 2.3,
      bool: false,
      enum: SuperNestedObjectEnum.Maybe,
      intList: [7, 8, 9],
      obj: {
        nestedBool: false,
        nestedIntList: [1, 2, 3],
        nestedUuid: uuidv1(),
        nestedEnum: ObjNestedEnum.No,
        nestedString: "stri",
        nestedInt: 24,
        nestedStringList: ["hello", "goodbye"],
        nestedObj: {
          nestedNestedUuid: uuidv1(),
          nestedNestedFloat: 4.2,
          nestedNestedEnum: NestedObjNestedNestedEnum.Maybe,
          nestedNestedInt: 32,
          nestedNestedString: "whaa",
          nestedNestedIntList: [4, 5, 6],
          nestedNestedStringList: ["sss"],
        },
      },
    };
    const user = await CreateUserAction.create(new LoggedOutExampleViewer(), {
      firstName: "Jane",
      lastName: "Doe",
      emailAddress: randomEmail(),
      phoneNumber: randomPhoneNumber(),
      password: random(),
      superNestedObject: obj,
    }).saveX();
    // we return fields which were not set as undefined so can't use strictEqual
    expect(await user.superNestedObject()).toMatchObject(obj);
  });

  test("union. cat", async () => {
    const obj: UserSuperNestedObject = {
      uuid: uuidv1(),
      int: 34,
      string: "whaa",
      float: 2.3,
      bool: false,
      enum: SuperNestedObjectEnum.Maybe,
      intList: [7, 8, 9],
      union: {
        name: "tabby",
        birthday: new Date(),
        breed: CatBreed.Bengal,
        kitten: true,
      },
    };
    const user = await CreateUserAction.create(new LoggedOutExampleViewer(), {
      firstName: "Jane",
      lastName: "Doe",
      emailAddress: randomEmail(),
      phoneNumber: randomPhoneNumber(),
      password: random(),
      superNestedObject: obj,
    }).saveX();
    const formattedObj = {
      ...obj,
      union: {
        ...obj.union,
        birthday: obj.union?.birthday.toISOString(),
      },
    };
    // we return fields which were not set as undefined so can't use strictEqual
    expect(await user.superNestedObject()).toMatchObject(formattedObj);
  });

  test("union. dog", async () => {
    const obj: UserSuperNestedObject = {
      uuid: uuidv1(),
      int: 34,
      string: "whaa",
      float: 2.3,
      bool: false,
      enum: SuperNestedObjectEnum.Maybe,
      intList: [7, 8, 9],
      union: {
        name: "scout",
        birthday: new Date(),
        breed: DogBreed.GermanShepherd,
        breedGroup: DogBreedGroup.Herding,
        puppy: false,
      },
    };
    const user = await CreateUserAction.create(new LoggedOutExampleViewer(), {
      firstName: "Jane",
      lastName: "Doe",
      emailAddress: randomEmail(),
      phoneNumber: randomPhoneNumber(),
      password: random(),
      superNestedObject: obj,
    }).saveX();
    const formattedObj = {
      ...obj,
      union: {
        ...obj.union,
        birthday: obj.union?.birthday.toISOString(),
      },
    };
    // we return fields which were not set as undefined so can't use strictEqual
    expect(await user.superNestedObject()).toMatchObject(formattedObj);
  });

  test("union. rabbit", async () => {
    const obj: UserSuperNestedObject = {
      uuid: uuidv1(),
      int: 34,
      string: "whaa",
      float: 2.3,
      bool: false,
      enum: SuperNestedObjectEnum.Maybe,
      intList: [7, 8, 9],
      union: {
        name: "hallo",
        birthday: new Date(),
        breed: RabbitBreed.AmericanChincilla,
      },
    };
    const user = await CreateUserAction.create(new LoggedOutExampleViewer(), {
      firstName: "Jane",
      lastName: "Doe",
      emailAddress: randomEmail(),
      phoneNumber: randomPhoneNumber(),
      password: random(),
      superNestedObject: obj,
    }).saveX();
    const formattedObj = {
      ...obj,
      union: {
        ...obj.union,
        birthday: obj.union?.birthday.toISOString(),
      },
    };
    // we return fields which were not set as undefined so can't use strictEqual
    expect(await user.superNestedObject()).toMatchObject(formattedObj);
  });

  test("nested list", async () => {
    const objs: UserNestedObjectList[] = [
      {
        type: "foo",
        enum: EnumUsedInList.Maybe,
        objects: [
          {
            int: 2,
          },
          {
            int: 3,
          },
        ],
        enumList: [IntEnumUsedInList.No],
      },
      {
        type: "bar",
        enum: EnumUsedInList.No,
        objects: [],
        enumList: [IntEnumUsedInList.Maybe],
      },
    ];
    const user = await CreateUserAction.create(new LoggedOutExampleViewer(), {
      firstName: "Jane",
      lastName: "Doe",
      emailAddress: randomEmail(),
      phoneNumber: randomPhoneNumber(),
      password: random(),
      nestedList: objs,
    }).saveX();
    expect(user.nestedList).toStrictEqual(objs);
  });

  test("can create + edit field loaded on demand", async () => {
    const obj: UserSuperNestedObject = {
      uuid: uuidv1(),
      int: 34,
      string: "whaa",
      float: 2.3,
      bool: false,
      enum: SuperNestedObjectEnum.Maybe,
      intList: [7, 8, 9],
      union: {
        name: "hallo",
        birthday: new Date(),
        breed: RabbitBreed.AmericanChincilla,
      },
    };

    const user = await CreateUserAction.create(new LoggedOutExampleViewer(), {
      firstName: "Jane",
      lastName: "Doe",
      emailAddress: randomEmail(),
      phoneNumber: randomPhoneNumber(),
      password: random(),
      superNestedObject: obj,
    }).saveX();
    const formattedObj = {
      ...obj,
      union: {
        ...obj.union,
        birthday: obj.union?.birthday.toISOString(),
      },
    };
    // we return fields which were not set as undefined so can't use strictEqual
    expect(await user.superNestedObject()).toMatchObject(formattedObj);

    const editedObj: UserSuperNestedObject = {
      uuid: uuidv1(),
      int: 23,
      string: "barrr",
      float: 2.233,
      bool: true,
      enum: SuperNestedObjectEnum.Yes,
      intList: [13, 28, 42],
      union: {
        name: "bye",
        birthday: new Date(),
        breed: RabbitBreed.AmericanChincilla,
      },
    };

    const edited = await EditUserAllFieldsAction.create(user.viewer, user, {
      superNestedObject: editedObj,
    }).saveX();
    const formattedEditedObj = {
      ...editedObj,
      union: {
        ...editedObj.union,
        birthday: editedObj.union?.birthday.toISOString(),
      },
    };
    // we return fields which were not set as undefined so can't use strictEqual
    expect(await edited.superNestedObject()).toMatchObject(formattedEditedObj);

    setLogLevels("query");
    const ml = new MockLogs();
    ml.mock();

    // confirm that we can create and edit with a field that's delayed fetch even if when we load
    // on its own, we don't fetch
    await User.loadX(user.viewer, user.id);

    expect(ml.logs.length).toBe(1);
    let execArray = /^SELECT (.+) FROM (.+) WHERE (.+)?/.exec(
      ml.logs[0].query || "",
    );

    const cols = execArray![1].split(", ");
    expect(cols.includes("super_nested_object")).toBe(false);
    // just confirm a few other fields included...
    expect(cols.includes("id")).toBe(true);
    expect(cols.includes("first_name")).toBe(true);
  });

  test("query empty with context", async () => {
    const user = await CreateUserAction.create(
      new LoggedOutExampleViewer(new TestContext()),
      {
        firstName: "Jane",
        lastName: "Doe",
        emailAddress: randomEmail(),
        phoneNumber: randomPhoneNumber(),
        password: random(),
      },
    ).saveX();
    expect(await user.superNestedObject()).toBe(null);
  });
});

test("enum list", async () => {
  const user = await CreateUserAction.create(new LoggedOutExampleViewer(), {
    firstName: "Jane",
    lastName: "Doe",
    emailAddress: randomEmail(),
    phoneNumber: randomPhoneNumber(),
    password: random(),
    daysOff: [UserDaysOff.Saturday, UserDaysOff.Sunday],
    preferredShift: [UserPreferredShift.Afternoon],
  }).saveX();
  expect(user.daysOff).toEqual([UserDaysOff.Saturday, UserDaysOff.Sunday]);
  expect(user.preferredShift).toEqual([UserPreferredShift.Afternoon]);
});

test("int enum", async () => {
  const user = await CreateUserAction.create(new LoggedOutExampleViewer(), {
    firstName: "Jane",
    lastName: "Doe",
    emailAddress: randomEmail(),
    phoneNumber: randomPhoneNumber(),
    password: random(),
    intEnum: UserIntEnum.DEACTIVATED,
  }).saveX();
  expect(user.intEnum).toEqual(UserIntEnum.DEACTIVATED);
});

test("misc", async () => {
  const user = await CreateUserAction.create(new LoggedOutExampleViewer(), {
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
