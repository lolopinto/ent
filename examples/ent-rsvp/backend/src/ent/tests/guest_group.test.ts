import { Event, GuestGroup } from "src/ent";
import { DB, IDViewer } from "@snowtop/ent";
import { randomEmail } from "src/util/random";
import CreateGuestGroupAction from "../guest_group/actions/create_guest_group_action";
import EditGuestGroupAction from "../guest_group/actions/edit_guest_group_action";
import DeleteGuestGroupAction from "../guest_group/actions/delete_guest_group_action";
import CreateGuestAction from "../guest/actions/create_guest_action";
import { createUser, createEvent, createActivity } from "src/testutils";

afterAll(async () => {
  await DB.getInstance().endPool();
});

async function createGuestGroup(event?: Event) {
  if (!event) {
    event = await createEvent();
  }

  const group = await CreateGuestGroupAction.create(event.viewer, {
    invitationName: "people",
    eventID: event.id,
  }).saveX();
  expect(group).toBeInstanceOf(GuestGroup);
  return group;
}

describe("create guest group", () => {
  test("valid", async () => {
    await createGuestGroup();
  });

  test("invalid", async () => {
    const [event, user] = await Promise.all([createEvent(), createUser()]);

    try {
      await CreateGuestGroupAction.create(new IDViewer(user.id), {
        invitationName: "people",
        eventID: event.id,
      }).saveX();
      fail("should have thrown");
    } catch (e) {
      expect((e as Error).message).toMatch(
        /Viewer with ID (.+) does not have permission to create GuestGroup/,
      );
    }
  });

  test("create group with activity flag set to invite all guests false", async () => {
    //    const event = await createEvent();
    const activity = await createActivity();
    const event = await activity.loadEventX();
    const group = await createGuestGroup(event);

    const invited = await group.queryGuestGroupToInvitedEvents().queryCount();
    expect(invited).toBe(0);
  });

  test("create group with activity flag set to invite all guests true", async () => {
    const event = await createEvent();
    const activity1 = await createActivity({ eventID: event.id }, event);
    const activity2 = await createActivity(
      {
        eventID: event.id,
        inviteAllGuests: true,
      },
      event,
    );

    const group = await createGuestGroup(event);

    const [count, invited] = await Promise.all([
      group.queryGuestGroupToInvitedEvents().queryCount(),
      group.queryGuestGroupToInvitedEvents().queryEnts(),
    ]);

    // only the one with the inviteAllGuests is the user invited to
    expect(count).toBe(1);
    expect(invited.length).toBe(1);
    expect(invited[0].id).toBe(activity2.id);
  });

  test("create guests while creating guest group", async () => {
    const event = await createEvent();
    const group = await CreateGuestGroupAction.create(event.viewer, {
      invitationName: "people",
      eventID: event.id,
      guests: [
        {
          name: "Arya Stark",
          emailAddress: randomEmail(),
        },
        {
          name: "Robb Stark",
        },
      ],
    }).saveX();
    expect(group).toBeInstanceOf(GuestGroup);
    const guests = await group.queryGuests().queryEnts();
    expect(guests.length).toBe(2);
    expect(guests.map((guest) => guest.name).sort()).toStrictEqual([
      "Arya Stark",
      "Robb Stark",
    ]);
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
    expect((e as Error).message).toMatch(
      /^ent (.+) is not visible for privacy reasons$/,
    );
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
      expect((e as Error).message).toMatch(
        /Viewer with ID (.+) does not have permission to edit GuestGroup/,
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
      expect((e as Error).message).toMatch(
        /Viewer with ID (.+) does not have permission to delete GuestGroup/,
      );
    }
  });
});

test("guest loading guest group", async () => {
  const group = await createGuestGroup();
  const inputs = [
    {
      name: "Edmure Tully",
      emailAddress: randomEmail(),
    },
    {
      name: "Roslyn Frey",
      emailAddress: randomEmail(),
    },
  ];

  await Promise.all(
    inputs.map(async (input) => {
      return CreateGuestAction.create(group.viewer, {
        guestGroupID: group.id,
        name: input.name,
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
