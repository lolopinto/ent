import { expectMutation } from "@lolopinto/ent-graphql-tests";
import {
  Address,
  User,
  Guest,
  Event,
  GuestGroup,
  EventActivity,
} from "src/ent";
import { IDViewer, DB, LoggedOutViewer } from "@lolopinto/ent";
import CreateUserAction from "src/ent/user/actions/create_user_action";
import { randomEmail } from "src/util/random";
import schema from "src/graphql/schema";
import { encodeGQLID, mustDecodeIDFromGQLID } from "@lolopinto/ent/graphql";
import CreateEventAction from "src/ent/event/actions/create_event_action";
import CreateEventActivityAction from "src/ent/event_activity/actions/create_event_activity_action";
import CreateGuestGroupAction from "src/ent/guest_group/actions/create_guest_group_action";
import CreateGuestAction, {
  GuestCreateInput,
} from "src/ent/guest/actions/create_guest_action";
import EventActivityAddInviteAction from "src/ent/event_activity/actions/event_activity_add_invite_action";
import EventActivityRemoveInviteAction from "src/ent/event_activity/actions/event_activity_remove_invite_action";

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

test("rsvp", async () => {
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
    firstName: "Robb",
    lastName: "Stark",
    emailAddress: randomEmail(),
    guestGroupID: group.id,
    eventID: group.eventID,
  }).saveX();

  // set attending
  await expectMutation(
    {
      viewer: new IDViewer(guest.id),
      mutation: "eventActivityRsvpStatusEdit",
      schema,
      args: {
        eventActivityID: encodeGQLID(activity),
        rsvpStatus: "ATTENDING", // need to convert enum...
        guestID: encodeGQLID(guest),
      },
    },
    ["eventActivity.id", encodeGQLID(activity)],
    // need to convert enum...
    ["eventActivity.viewerRsvpStatus", "ATTENDING"],
  );

  // set declined
  await expectMutation(
    {
      viewer: new IDViewer(guest.id),
      mutation: "eventActivityRsvpStatusEdit",
      schema,
      args: {
        eventActivityID: encodeGQLID(activity),
        rsvpStatus: "DECLINED",
        guestID: encodeGQLID(guest),
      },
    },
    ["eventActivity.id", encodeGQLID(activity)],
    ["eventActivity.viewerRsvpStatus", "DECLINED"],
  );
  // const activity2 = await EventActivity.loadX(
  //   new IDViewer(guest.id),
  //   activity.id,
  // );
  // const r = await activity2.viewerRsvpStatus();
  // console.log(r);
});
