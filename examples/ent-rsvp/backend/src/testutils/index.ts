import { Guest, Event, User, EventActivity, GuestGroup } from "src/ent";
import { ID, IDViewer, LoggedOutViewer } from "@snowtop/ent";
import { randomEmail } from "src/util/random";
import CreateUserAction from "src/ent/user/actions/create_user_action";
import CreateEventAction from "src/ent/event/actions/create_event_action";
import CreateEventActivityAction, {
  EventActivityCreateInput,
} from "src/ent/event_activity/actions/create_event_activity_action";
import CreateGuestGroupAction from "src/ent/guest_group/actions/create_guest_group_action";
import CreateGuestAction, {
  GuestCreateInput,
} from "src/ent/guest/actions/create_guest_action";
import EventActivityAddInviteAction from "src/ent/event_activity/actions/event_activity_add_invite_action";
import { Builder } from "@snowtop/ent/action";

export async function createUser() {
  const user = await CreateUserAction.create(new LoggedOutViewer(), {
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: randomEmail(),
    password: "pa$$w0rd",
  }).saveX();
  expect(user).toBeInstanceOf(User);
  return user;
}

export async function createEvent() {
  const user = await createUser();
  const event = await CreateEventAction.create(new IDViewer(user.id), {
    name: `${user.firstName}'s wedding`,
  }).saveX();
  expect(event).toBeInstanceOf(Event);
  return event;
}

export async function createActivity(
  input?: Partial<EventActivityCreateInput>,
  event?: Event,
) {
  let eventID: ID | Builder<Event>;

  if (event && input?.eventID) {
    if (event.id !== input.eventID) {
      throw new Error(`passed eventID and event that don't match`);
    }
  }

  if (!event) {
    event = await createEvent();
    eventID = event.id;
  } else if (input?.eventID) {
    eventID = input.eventID;
  } else {
    eventID = event.id;
  }

  return await CreateEventActivityAction.create(event.viewer, {
    startTime: new Date(),
    location: "fun location",
    name: "welcome dinner",
    eventID: eventID,
    ...input,
  }).saveX();
}

type input = Pick<GuestCreateInput, "name" | "emailAddress">;

const inputs: input[][] = [
  [
    {
      name: "Robb Stark",
      emailAddress: randomEmail(),
    },
    {
      name: "Talisa Stark",
      emailAddress: randomEmail(),
    },
  ],
  [
    {
      name: "Catelyn Stark",
      emailAddress: randomEmail(),
    },
  ],
  [
    {
      name: "Edmure Tully",
      emailAddress: randomEmail(),
    },
    {
      name: "Roslyn Frey",
      emailAddress: randomEmail(),
    },
  ],
];

export async function createActivityAndGroup(): Promise<
  [EventActivity, GuestGroup]
> {
  const activity = await createActivity();
  const event = await activity.loadEventX();
  const group = await CreateGuestGroupAction.create(event.viewer, {
    invitationName: "people",
    eventID: event.id,
  }).saveX();

  return [activity, group];
}

export async function createAndInvite(): Promise<[EventActivity, GuestGroup]> {
  const [activity, group] = await createActivityAndGroup();
  const count = await activity.queryInvites().queryCount();
  expect(count).toBe(0);

  const reloaded = await EventActivityAddInviteAction.saveXFromID(
    activity.viewer,
    activity.id,
    group.id,
  );
  const newCount = await reloaded.queryInvites().queryCount();
  expect(newCount).toBe(1);

  return [activity, group];
}

export async function createAndInvitePlusGuests(
  idx: number,
): Promise<[EventActivity, Guest[]]> {
  const [activity, group] = await createAndInvite();

  // TODO need to create this when creating guest group
  // so build on top of https://github.com/lolopinto/ent/pull/205

  const guests = await createGuests(group, idx);

  return [activity, guests];
}

export async function createGuests(
  group: GuestGroup,
  idx: number,
): Promise<Guest[]> {
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

export async function createGuestPlus() {
  const activity = await createActivity();
  const event = await activity.loadEventX();
  const group = await CreateGuestGroupAction.create(event.viewer, {
    invitationName: "people",
    eventID: event.id,
  }).saveX();

  await EventActivityAddInviteAction.saveXFromID(
    activity.viewer,
    activity.id,
    group.id,
  );

  const guest = await CreateGuestAction.create(group.viewer, {
    name: "Robb Stark",
    emailAddress: randomEmail(),
    guestGroupID: group.id,
    eventID: group.eventID,
  }).saveX();
  return { guest, activity };
}
