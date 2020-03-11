import { createUser } from "../../src/ent/user";
import Event, {
  createEvent,
  editEvent,
  deleteEvent,
} from "../../src/ent/event";

import { LogedOutViewer } from "ent/viewer";
import DB from "ent/db";

const loggedOutViewer = new LogedOutViewer();

// TODO we need something that does this by default for all tests
afterAll(async () => {
  await DB.getInstance().endPool();
});

async function create(startTime: Date): Promise<Event> {
  let user = await createUser(loggedOutViewer, {
    firstName: "Jon",
    lastName: "Snow",
  });
  if (!user) {
    fail("could not create user");
  }
  let event = await createEvent(loggedOutViewer, {
    name: "fun event",
    creatorID: user.id as string,
    startTime: startTime,
    location: "location",
  });
  if (event == null) {
    fail("could not create event");
  }
  return event;
}

test("create event", async () => {
  try {
    let date = new Date();
    let event = await create(date);

    expect(event.name).toBe("fun event");
    expect(event.location).toBe("location");
    // Todo handle this better either via mock or something else
    expect(event.startTime.toDateString()).toBe(date.toDateString());
    expect(event.creatorID).not.toBe(null);
    expect(event.endTime).toBe(null);
  } catch (e) {
    fail(e.message);
  }
});

test("edit event", async () => {
  try {
    let date = new Date();
    let event = await create(date);

    let editedEvent = await editEvent(loggedOutViewer, event.id, {
      location: "fun location",
    });
    expect(editedEvent).not.toBe(null);
    expect(editedEvent?.name).toBe("fun event");
    expect(editedEvent?.location).toBe("fun location");
    expect(editedEvent?.startTime.toDateString()).toBe(date.toDateString());
    expect(editedEvent?.creatorID).not.toBe(null);
    expect(event.endTime).toBe(null);
  } catch (e) {
    fail(e.message);
  }
});

test("edit nullable field", async () => {
  try {
    let date = new Date();
    let event = await create(date);

    let endTime = new Date(date.getTime());
    endTime.setTime(date.getTime() + 24 * 60 * 60);

    let editedEvent = await editEvent(loggedOutViewer, event.id, {
      endTime: endTime,
    });
    expect(editedEvent).not.toBe(null);
    expect(editedEvent?.name).toBe("fun event");
    expect(editedEvent?.location).toBe("location");
    expect(editedEvent?.startTime.toDateString()).toBe(date.toDateString());
    expect(editedEvent?.creatorID).not.toBe(null);
    expect(editedEvent?.endTime?.toDateString()).toBe(endTime.toDateString());

    // re-edit and clear the value
    editedEvent = await editEvent(loggedOutViewer, event.id, { endTime: null });
    expect(editedEvent).not.toBe(null);
    expect(editedEvent?.name).toBe("fun event");
    expect(editedEvent?.location).toBe("location");
    expect(editedEvent?.startTime.toDateString()).toBe(date.toDateString());
    expect(editedEvent?.creatorID).not.toBe(null);
    expect(editedEvent?.endTime).toBe(null);
  } catch (e) {
    fail(e.message);
  }
});

test("delete event", async () => {
  try {
    let event = await create(new Date());

    await deleteEvent(loggedOutViewer, event.id);

    let loadEvent = await Event.load(loggedOutViewer, event.id);
    expect(loadEvent).toBe(null);
  } catch (e) {
    fail(e.message);
  }
});
