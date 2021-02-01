import {
  EventActivity,
  GuestData,
  EventActivityToAttendingQuery,
} from "src/ent";
import { DB, IDViewer } from "@lolopinto/ent";
import CreateEventActivityAction from "../event_activity/actions/create_event_activity_action";
import CreateGuestGroupAction from "../guest_group/actions/create_guest_group_action";
import EventActivityAddInviteAction from "../event_activity/actions/event_activity_add_invite_action";
import EventActivityRemoveInviteAction from "../event_activity/actions/event_activity_remove_invite_action";
import { Guest } from "../guest";
import EditEventActivityRsvpStatusAction from "../event_activity/actions/edit_event_activity_rsvp_status_action";
import { EventActivityRsvpStatusInput } from "../event_activity/actions/generated/edit_event_activity_rsvp_status_action_base";
import { EventActivityRsvpStatus } from "../generated/event_activity_base";

import {
  createUser,
  createEvent,
  createActivity,
  createActivityAndGroup,
  createAndInvite,
  createAndInvitePlusGuests,
  createGuests,
} from "src/testutils";

afterAll(async () => {
  await DB.getInstance().endPool();
});

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

describe("rsvps", () => {
  async function doRsvpForSelf(
    input: EventActivityRsvpStatusInput,
    output: EventActivityRsvpStatus,
    activityCount: (activity: EventActivity) => Promise<number>,
    guestCount: (guest: Guest) => Promise<number>,
    options?: {
      // must provide both eventActivity and
      eventActivity?: EventActivity;
      guests?: Guest[];
      dietaryRestrictions?: string;
    },
  ): Promise<[EventActivity, Guest[]]> {
    let activity: EventActivity;
    let guests: Guest[];
    if (options && options.eventActivity && options.guests) {
      activity = options.eventActivity;
      guests = options.guests;
    } else if (
      options &&
      ((options.eventActivity && !options.guests) ||
        (!options.eventActivity && options.guests))
    ) {
      throw new Error(
        "must provide both or neither of guests and eventActivity",
      );
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
        dietaryRestrictions: options?.dietaryRestrictions,
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
      {
        eventActivity: activity,
        guests,
      },
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
      {
        eventActivity: activity,
        guests,
      },
    );

    // confirm count has changed back to 0
    count = await activity.loadAttendingRawCountX();
    expect(count).toEqual(0);
  });

  test("rsvp dietary restrictions", async () => {
    // start with attending
    let [activity, guests] = await doRsvpForSelf(
      EventActivityRsvpStatusInput.Attending,
      EventActivityRsvpStatus.Attending,
      (activity: EventActivity) => activity.loadAttendingRawCountX(),
      (guest: Guest) => guest.loadGuestToAttendingEventsRawCountX(),
      {
        dietaryRestrictions: "shellfish",
      },
    );

    let edges = await activity.loadAttendingEdges();
    expect(edges.length).toEqual(1);

    let edgesMap = await EventActivityToAttendingQuery.query(
      activity.viewer,
      activity.id,
    ).queryEdges();
    let edges2 = edgesMap.get(activity.id) || [];
    expect(edges2.length).toEqual(1);

    const dr = await edges2[0].dietaryRestrictions({
      getViewer() {
        return activity.viewer;
      },
    });
    expect(dr).toEqual("shellfish");

    let edge = edges[0];
    expect(edge.data).toBeDefined();

    let guestData = await GuestData.loadX(activity.viewer, edge.data!);
    expect(guestData.dietaryRestrictions).toEqual("shellfish");

    await doRsvpForSelf(
      EventActivityRsvpStatusInput.Declined,
      EventActivityRsvpStatus.Declined,
      (activity: EventActivity) => activity.loadDeclinedRawCountX(),
      (guest: Guest) => guest.loadGuestToDeclinedEventsRawCountX(),
      {
        eventActivity: activity,
        guests: guests,
        dietaryRestrictions: "shellfish",
      },
    );

    // can't load it anymore now that we've declined the rsvp
    const loaded = await GuestData.load(activity.viewer, guestData.id);
    expect(loaded).toBeNull();

    // change rsvp back to attending
    await doRsvpForSelf(
      EventActivityRsvpStatusInput.Attending,
      EventActivityRsvpStatus.Attending,
      (activity: EventActivity) => activity.loadAttendingRawCountX(),
      (guest: Guest) => guest.loadGuestToAttendingEventsRawCountX(),
      {
        eventActivity: activity,
        guests: guests,
        dietaryRestrictions: "mushrooms",
      },
    );

    edges = await activity.loadAttendingEdges();
    expect(edges.length).toEqual(1);

    edge = edges[0];
    expect(edge.data).toBeDefined();

    const guestData2 = await GuestData.loadX(activity.viewer, edge.data!);
    expect(guestData2.dietaryRestrictions).toEqual("mushrooms");

    expect(guestData.id).not.toEqual(guestData2.id);
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
