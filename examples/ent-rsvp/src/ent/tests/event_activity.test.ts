import { Event, User, EventActivity } from "src/ent";
import { DB, IDViewer, LoggedOutViewer } from "@lolopinto/ent";
import CreateUserAction from "../user/actions/create_user_action";
import { randomEmail } from "src/util/random";
import CreateEventAction from "../event/actions/create_event_action";
import CreateEventActivityAction from "../event_activity/actions/create_event_activity_action";

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
