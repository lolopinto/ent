import { Event, User, EventActivity } from "src/ent";
import { DB, IDViewer, LoggedOutViewer } from "@lolopinto/ent";
import CreateUserAction from "../user/actions/create_user_action";
import { randomEmail } from "src/util/random";
import CreateEventAction from "../event/actions/create_event_action";
import CreateEventActivityAction from "../event_activity/actions/create_event_activity_action";
import CreateGuestGroupAction from "../guest_group/actions/create_guest_group_action";
import CreateGuestAction, {
  GuestCreateInput,
} from "../guest/actions/create_guest_action";
import EventActivityAddInviteAction from "../event_activity/actions/event_activity_add_invite_action";
import { cachedDataVersionTag } from "v8";
import EventActivityRemoveInviteAction from "../event_activity/actions/event_activity_remove_invite_action";

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

async function createActivity() {
  const event = await createEvent();
  const activity = await CreateEventActivityAction.create(
    new IDViewer(event.creatorID),
    {
      startTime: new Date(),
      location: "fun location",
      name: "welcome dinner",
      eventID: event.id,
    },
  ).saveX();
  return activity;
}

describe("create event activity", () => {
  test("valid", async () => {
    await createActivity();
  });

  test("invalid", async () => {
    const [user, event] = await Promise.all([createUser(), createEvent()]);
    try {
      await CreateEventActivityAction.create(new IDViewer(user.id), {
        startTime: new Date(),
        location: "fun location",
        name: "welcome dinner",
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

describe("load activity", () => {
  // should fail when we support rsvps. works for now...
  test.skip("invalid", async () => {
    const [activity, user] = await Promise.all([
      createActivity(),
      createUser(),
    ]);
    try {
      await EventActivity.loadX(new IDViewer(user.id), activity.id);
      fail("should have thrown");
    } catch (e) {
      expect(e.message).toBe(
        "ent undefined is not visible for privacy reasons",
      );
    }
  });
});

type input = Pick<GuestCreateInput, "firstName" | "lastName" | "emailAddress">;

const inputs: input[][] = [
  [
    {
      firstName: "Robb",
      lastName: "Stark",
      emailAddress: randomEmail(),
    },
    {
      firstName: "Talisa",
      lastName: "Stark",
      emailAddress: randomEmail(),
    },
  ],
  [
    {
      firstName: "Catelyn",
      lastName: "Stark",
      emailAddress: randomEmail(),
    },
  ],
  [
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
  ],
];
// TODO for accepting/declining rsvps
// TODO need to create this when creating guest group
// so build on top of https://github.com/lolopinto/ent/pull/205
// await Promise.all(
//   inputs[0].map(async (input) => {
//     return CreateGuestAction.create(event.viewer, {
//       ...input,
//       emailAddress: randomEmail(),
//       guestGroupID: group.id,
//       eventID: group.eventID,
//     }).saveX;
//   }),
// );

describe.only("invites", () => {
  async function createAndInvite() {
    const activity = await createActivity();
    const event = await activity.loadEventX();
    const group = await CreateGuestGroupAction.create(event.viewer, {
      invitationName: "people",
      eventID: event.id,
    }).saveX();

    const count = await activity.loadInvitesRawCountX();
    expect(count).toBe(0);

    const reloaded = await EventActivityAddInviteAction.saveXFromID(
      activity.viewer,
      activity.id,
      group.id,
    );
    const newCount = await reloaded.loadInvitesRawCountX();
    expect(newCount).toBe(1);

    return [activity, group];
  }

  test("invite guest group", async () => {
    await createAndInvite();
  });

  test("invite guest group. non creator", async () => {
    const activity = await createActivity();
    const event = await activity.loadEventX();
    const group = await CreateGuestGroupAction.create(event.viewer, {
      invitationName: "people",
      eventID: event.id,
    }).saveX();

    const user = await createUser();

    try {
      await EventActivityAddInviteAction.saveXFromID(
        new IDViewer(user.id),
        activity.id,
        group.id,
      );
      fail("should have thrown");
    } catch (e) {
      expect(e.message).toMatch(
        /^ent (.+) is not visible for privacy reasons$/,
      );
    }
  });

  test("invite wrong guest group", async () => {
    const [activity, activity2] = await Promise.all([
      createActivity(),
      createActivity(),
    ]);
    const event = await activity.loadEventX();
    const group = await CreateGuestGroupAction.create(event.viewer, {
      invitationName: "people",
      eventID: event.id,
    }).saveX();

    try {
      await EventActivityAddInviteAction.saveXFromID(
        activity2.viewer,
        activity2.id,
        group.id,
      );
      fail("should have thrown");
    } catch (e) {
      expect(e.message).toMatch(
        /^ent (.+) is not visible for privacy reasons$/,
      );
    }
  });

  test("remove invite", async () => {
    const [activity, group] = await createAndInvite();

    const reloaded = await EventActivityRemoveInviteAction.saveXFromID(
      activity.viewer,
      activity.id,
      group.id,
    );
    const newCount = await reloaded.loadInvitesRawCountX();
    expect(newCount).toBe(0);

    // calling it twice is fine
    const reloaded2 = await EventActivityRemoveInviteAction.saveXFromID(
      activity.viewer,
      activity.id,
      group.id,
    );
    const newCount2 = await reloaded2.loadInvitesRawCountX();
    expect(newCount2).toBe(0);
  });

  test("remove invite non creator", async () => {
    const [activity, group] = await createAndInvite();
    const user = await createUser();

    try {
      await EventActivityRemoveInviteAction.saveXFromID(
        new IDViewer(user.id),
        activity.id,
        group.id,
      );
      fail("should have thrown");
    } catch (e) {
      expect(e.message).toMatch(
        /^ent (.+) is not visible for privacy reasons$/,
      );
    }
  });

  test("remove invite wrong guest group", async () => {
    const [activity, _] = await createAndInvite();
    const event2 = await createEvent();
    const group2 = await CreateGuestGroupAction.create(event2.viewer, {
      invitationName: "people",
      eventID: event2.id,
    }).saveX();

    try {
      await EventActivityRemoveInviteAction.saveXFromID(
        activity.viewer,
        activity.id,
        group2.id,
      );
      fail("should have thrown");
    } catch (e) {
      expect(e.message).toMatch(
        /^ent (.+) is not visible for privacy reasons$/,
      );
    }
  });
});
