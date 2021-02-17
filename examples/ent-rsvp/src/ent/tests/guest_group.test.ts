import { Event, User, GuestGroup } from "src/ent";
import { DB, IDViewer, LoggedOutViewer } from "@lolopinto/ent";
import CreateUserAction from "../user/actions/create_user_action";
import { randomEmail } from "src/util/random";
import CreateEventAction from "../event/actions/create_event_action";
import CreateGuestGroupAction from "../guest_group/actions/create_guest_group_action";
import EditGuestGroupAction from "../guest_group/actions/edit_guest_group_action";
import DeleteGuestGroupAction from "../guest_group/actions/delete_guest_group_action";
import CreateGuestAction from "../guest/actions/create_guest_action";

afterAll(async () => {
  await DB.getInstance().endPool();
});

async function createUser() {
  const user = await CreateUserAction.create(new LoggedOutViewer(), {
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: randomEmail(),
  }).saveX();
  expect(user).toBeInstanceOf(User);
  return user;
}

async function createEvent() {
  const user = await createUser();
  const event = await CreateEventAction.create(new IDViewer(user.id), {
    creatorID: user.id,
    name: `${user.firstName}'s wedding`,
  }).saveX();
  expect(event).toBeInstanceOf(Event);
  return event;
}

async function createGuestGroup() {
  const event = await createEvent();

  const group = await CreateGuestGroupAction.create(
    new IDViewer(event.creatorID),
    {
      invitationName: "people",
      eventID: event.id,
    },
  ).saveX();
  expect(group).toBeInstanceOf(GuestGroup);
  return group;
}

describe("create guest group", () => {
  test("valid", async () => {
    await createGuestGroup();
  });

  test("valid", async () => {
    const [event, user] = await Promise.all([createEvent(), createUser()]);

    try {
      await CreateGuestGroupAction.create(new IDViewer(user.id), {
        invitationName: "people",
        eventID: event.id,
      }).saveX();
      fail("should have thrown");
    } catch (e) {
      expect(e.message).toBe(
        "ent undefined is not visible for privacy reasons",
      );
    }
  });
});

test("load guest group", async () => {
  const [user, guestGroup] = await Promise.all([
    createUser(),
    createGuestGroup(),
  ]);

  try {
    await GuestGroup.loadX(new IDViewer(user.id), guestGroup.id);
    fail("should have thrown");
  } catch (e) {
    expect(e.message).toMatch(/^ent (.+) is not visible for privacy reasons$/);
  }
});

describe("edit guest group", () => {
  test("valid", async () => {
    const group = await createGuestGroup();
    const edited = await EditGuestGroupAction.create(group.viewer, group, {
      invitationName: "foo",
    }).saveX();
    expect(edited.invitationName).toBe("foo");
  });

  test("invalid", async () => {
    const [group, user] = await Promise.all([createGuestGroup(), createUser()]);
    try {
      await EditGuestGroupAction.create(new IDViewer(user.id), group, {
        invitationName: "foo",
      }).saveX();
      fail("should have thrown");
    } catch (e) {
      expect(e.message).toMatch(
        /^ent (.+) is not visible for privacy reasons$/,
      );
    }
  });
});

describe("delete guest group", () => {
  test("valid", async () => {
    const group = await createGuestGroup();
    await DeleteGuestGroupAction.create(group.viewer, group).saveX();
    const loaded = await GuestGroup.load(group.viewer, group.id);
    expect(loaded).toBeNull();
  });

  test("invalid", async () => {
    const [group, user] = await Promise.all([createGuestGroup(), createUser()]);
    try {
      await DeleteGuestGroupAction.create(new IDViewer(user.id), group).saveX();
      fail("should have thrown");
    } catch (e) {
      expect(e.message).toMatch(
        /^ent (.+) is not visible for privacy reasons$/,
      );
    }
  });
});

test("guest loading guest group", async () => {
  const group = await createGuestGroup();
  const inputs = [
    {
      firstName: "Edmure",
      lastName: "Tully",
      emailAddress: randomEmail(),
    },
    {
      firstName: "Roslyn",
      lastName: "Frey",
      emailAddress: randomEmail(),
    },
  ];

  await Promise.all(
    inputs.map(async (input) => {
      return CreateGuestAction.create(group.viewer, {
        guestGroupID: group.id,
        firstName: input.firstName,
        lastName: input.lastName,
        emailAddress: input.emailAddress,
        eventID: group.eventID,
      }).saveX();
    }),
  );

  const guests = await group.queryGuests().queryEnts();
  expect(guests.length).toBe(inputs.length);

  // guest can load group
  await GuestGroup.loadX(new IDViewer(guests[0].id), group.id);
});
