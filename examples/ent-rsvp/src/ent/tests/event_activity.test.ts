import { Event, User, EventActivity, GuestGroup } from "src/ent";
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
import { Guest } from "../guest";
import EditEventActivityRsvpStatusAction from "../event_activity/actions/edit_event_activity_rsvp_status_action";
import { EventActivityRsvpStatusInput } from "../event_activity/actions/generated/edit_event_activity_rsvp_status_action_base";
import { EventActivityRsvpStatus } from "../generated/event_activity_base";

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
  // random user can't load since not creator or invited
  test("invalid", async () => {
    const [activity, user] = await Promise.all([
      createActivity(),
      createUser(),
    ]);
    try {
      await EventActivity.loadX(new IDViewer(user.id), activity.id);
      fail("should have thrown");
    } catch (e) {
      expect(e.message).toMatch(
        /^ent (.+) is not visible for privacy reasons$/,
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

async function createActivityAndGroup(): Promise<[EventActivity, GuestGroup]> {
  const activity = await createActivity();
  const event = await activity.loadEventX();
  const group = await CreateGuestGroupAction.create(event.viewer, {
    invitationName: "people",
    eventID: event.id,
  }).saveX();

  return [activity, group];
}

async function createAndInvite(): Promise<[EventActivity, GuestGroup]> {
  const [activity, group] = await createActivityAndGroup();
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

describe("invites", () => {
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

async function createAndInvitePlusGuests(
  idx: number,
): Promise<[EventActivity, Guest[]]> {
  const [activity, group] = await createAndInvite();

  // TODO need to create this when creating guest group
  // so build on top of https://github.com/lolopinto/ent/pull/205

  const guests = await createGuests(group, idx);

  return [activity, guests];
}

async function createGuests(group: GuestGroup, idx: number): Promise<Guest[]> {
  return await Promise.all(
    inputs[idx].map(async (input) => {
      return CreateGuestAction.create(group.viewer, {
        ...input,
        emailAddress: randomEmail(),
        guestGroupID: group.id,
        eventID: group.eventID,
      }).saveX();
    }),
  );
}

describe("rsvps", () => {
  async function doRsvpForSelf(
    input: EventActivityRsvpStatusInput,
    output: EventActivityRsvpStatus,
    activityCount: (activity: EventActivity) => Promise<number>,
    guestCount: (guest: Guest) => Promise<number>,
    guestActivity?: [EventActivity, Guest[]],
  ): Promise<[EventActivity, Guest[]]> {
    let activity: EventActivity;
    let guests: Guest[];
    if (guestActivity) {
      [activity, guests] = guestActivity;
    } else {
      [activity, guests] = await createAndInvitePlusGuests(0);
    }

    expect(guests.length).toBe(2);
    let guest = guests[0];
    let count = await activityCount(activity);
    expect(count).toBe(0);
    count = await guestCount(guest);
    expect(count).toBe(0);

    const vc = new IDViewer(guest.id);
    const activity2 = await EditEventActivityRsvpStatusAction.saveXFromID(
      vc,
      activity.id,
      {
        guestID: guest.id,
        rsvpStatus: input,
      },
    );

    count = await activityCount(activity2);
    expect(count).toBe(1);

    // reload guest
    guest = await Guest.loadX(vc, guest.id);

    count = await guestCount(guest);
    expect(count).toBe(1);

    // rsvp status is as expected
    const rsvpStatus = await activity2.viewerRsvpStatus();
    expect(rsvpStatus).toBe(output);

    return [activity, guests];
  }

  async function doRsvpForOther(
    input: EventActivityRsvpStatusInput,
    // TODO we need to be able to check rsvp status for other user...
    // need to figure out best way to show this in graphql
    output: EventActivityRsvpStatus,
    activityCount: (activity: EventActivity) => Promise<number>,
    guestCount: (guest: Guest) => Promise<number>,
  ) {
    const [activity, guests] = await createAndInvitePlusGuests(0);

    expect(guests.length).toBe(2);
    let guest = guests[0];
    let count = await activityCount(activity);
    expect(count).toBe(0);
    // viewer is second user
    const vc = new IDViewer(guests[1].id);
    count = await guestCount(guest);
    expect(count).toBe(0);

    const activity2 = await EditEventActivityRsvpStatusAction.saveXFromID(
      vc,
      activity.id,
      {
        guestID: guest.id,
        rsvpStatus: input,
      },
    );

    count = await activityCount(activity2);
    expect(count).toBe(1);

    // reload guest
    guest = await Guest.loadX(vc, guest.id);

    count = await guestCount(guest);
    expect(count).toBe(1);

    // rsvp status is attending
    const rsvpStatus = await activity2.viewerRsvpStatus();
    // can rsvp since didn't rsvp for self /rsvped for guest
    expect(rsvpStatus).toBe(EventActivityRsvpStatus.CanRsvp);
  }

  test("rsvp attending for self", async () => {
    await doRsvpForSelf(
      EventActivityRsvpStatusInput.Attending,
      EventActivityRsvpStatus.Attending,
      (activity: EventActivity) => activity.loadAttendingRawCountX(),
      (guest: Guest) => guest.loadGuestToAttendingEventsRawCountX(),
    );
  });

  test("rsvp declined for self", async () => {
    await doRsvpForSelf(
      EventActivityRsvpStatusInput.Declined,
      EventActivityRsvpStatus.Declined,
      (activity: EventActivity) => activity.loadDeclinedRawCountX(),
      (guest: Guest) => guest.loadGuestToDeclinedEventsRawCountX(),
    );
  });

  test("rsvp switch for self", async () => {
    // start with declined
    let [activity, guests] = await doRsvpForSelf(
      EventActivityRsvpStatusInput.Declined,
      EventActivityRsvpStatus.Declined,
      (activity: EventActivity) => activity.loadDeclinedRawCountX(),
      (guest: Guest) => guest.loadGuestToDeclinedEventsRawCountX(),
    );

    // switch to attending

    await doRsvpForSelf(
      EventActivityRsvpStatusInput.Attending,
      EventActivityRsvpStatus.Attending,
      (activity: EventActivity) => activity.loadAttendingRawCountX(),
      (guest: Guest) => guest.loadGuestToAttendingEventsRawCountX(),
      [activity, guests],
    );

    // confirm count has changed back to 0
    let count = await activity.loadDeclinedRawCountX();
    expect(count).toEqual(0);

    // switch back one more time to declined
    await doRsvpForSelf(
      EventActivityRsvpStatusInput.Declined,
      EventActivityRsvpStatus.Declined,
      (activity: EventActivity) => activity.loadDeclinedRawCountX(),
      (guest: Guest) => guest.loadGuestToDeclinedEventsRawCountX(),
      [activity, guests],
    );

    // confirm count has changed back to 0
    count = await activity.loadAttendingRawCountX();
    expect(count).toEqual(0);
  });

  test("rsvp attending for other guest in group", async () => {
    await doRsvpForOther(
      EventActivityRsvpStatusInput.Attending,
      EventActivityRsvpStatus.Attending,
      (activity: EventActivity) => activity.loadAttendingRawCountX(),
      (guest: Guest) => guest.loadGuestToAttendingEventsRawCountX(),
    );
  });

  test("rsvp declined for other guest in group", async () => {
    await doRsvpForOther(
      EventActivityRsvpStatusInput.Declined,
      EventActivityRsvpStatus.Declined,
      (activity: EventActivity) => activity.loadDeclinedRawCountX(),
      (guest: Guest) => guest.loadGuestToDeclinedEventsRawCountX(),
    );
  });

  test("can't rsvp if not invited", async () => {
    const [activity, group] = await createActivityAndGroup();
    const guests = await createGuests(group, 0);
    expect(guests.length).toBe(2);

    const guest = guests[0];

    try {
      await EditEventActivityRsvpStatusAction.saveXFromID(
        new IDViewer(guest.id),
        activity.id,
        {
          guestID: guest.id,
          rsvpStatus: EventActivityRsvpStatusInput.Attending,
        },
      );
      fail("should have thrown");
    } catch (e) {
      expect(e.message).toMatch(
        /^ent (.+) is not visible for privacy reasons$/,
      );
    }
  });

  test("can't rsvp if viewer not same guest group", async () => {
    const [activity, guests] = await createAndInvitePlusGuests(0);

    const group2 = await CreateGuestGroupAction.create(activity.viewer, {
      invitationName: "people",
      eventID: activity.eventID,
    }).saveX();
    expect(guests.length).toBe(2);
    const guests2 = await createGuests(group2, 1);
    expect(guests2.length).toBe(1);

    const guest = guests[0];

    try {
      await EditEventActivityRsvpStatusAction.saveXFromID(
        new IDViewer(guests2[0].id),
        activity.id,
        {
          guestID: guest.id,
          rsvpStatus: EventActivityRsvpStatusInput.Attending,
        },
      );
      fail("should have thrown");
    } catch (e) {
      expect(e.message).toMatch(
        /^ent (.+) is not visible for privacy reasons$/,
      );
    }
  });
});
