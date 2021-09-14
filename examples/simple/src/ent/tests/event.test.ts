import { LoggedOutViewer, IDViewer, DB } from "@snowtop/ent";
import { Event } from "../";
import { randomEmail, randomPhoneNumber } from "../../util/random";
import CreateUserAction from "../user/actions/create_user_action";
import CreateEventAction from "../event/actions/create_event_action";
import EditEventAction from "../event/actions/edit_event_action";
import DeleteEventAction from "../event/actions/delete_event_action";

const loggedOutViewer = new LoggedOutViewer();

// TODO we need something that does this by default for all tests
afterAll(async () => {
  await DB.getInstance().endPool();
});

async function createUser() {
  return await CreateUserAction.create(loggedOutViewer, {
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: randomEmail(),
    phoneNumber: randomPhoneNumber(),
    password: "pa$$w0rd",
  }).saveX();
}

async function create(startTime: Date): Promise<Event> {
  let user = await createUser();

  return await CreateEventAction.create(loggedOutViewer, {
    name: "fun event",
    creatorID: user.id,
    startTime: startTime,
    location: "location",
  }).saveX();
}

test("create event", async () => {
  let date = new Date();
  let event = await create(date);

  expect(event.name).toBe("fun event");
  expect(event.location).toBe("location");
  // Todo handle this better either via mock or something else
  expect(event.startTime.toDateString()).toBe(date.toDateString());
  expect(event.creatorID).not.toBe(null);
  expect(event.endTime).toBe(null);

  // reload the event from the viewer's perspective
  const v = new IDViewer(event.creatorID);
  event = await Event.loadX(v, event.id);
  const creator = await event.loadCreator();
  expect(creator).not.toBe(null);
  expect(creator!.id).toBe(event.creatorID);

  // creator is added as host too
  const hosts = await event.queryHosts().queryEnts();
  expect(hosts.length).toBe(1);
  expect(hosts[0].id).toBe(event.creatorID);
});

test("edit event", async () => {
  let date = new Date();
  let event = await create(date);

  let editedEvent = await EditEventAction.create(
    new IDViewer(event.creatorID),
    event,
    {
      location: "fun location",
    },
  ).saveX();
  expect(editedEvent).not.toBe(null);
  expect(editedEvent.name).toBe("fun event");
  expect(editedEvent.location).toBe("fun location");
  expect(editedEvent.startTime.toDateString()).toBe(date.toDateString());
  expect(editedEvent.creatorID).not.toBe(null);
  expect(editedEvent.endTime).toBe(null);
});

test("edit nullable field", async () => {
  let date = new Date();
  let event = await create(date);

  let endTime = new Date(date.getTime());
  endTime.setTime(date.getTime() + 24 * 60 * 60);

  const vc = new IDViewer(event.creatorID);
  let editedEvent = await EditEventAction.create(vc, event, {
    endTime: endTime,
  }).saveX();
  expect(editedEvent).not.toBe(null);
  expect(editedEvent.name).toBe("fun event");
  expect(editedEvent.location).toBe("location");
  expect(editedEvent.startTime.toDateString()).toBe(date.toDateString());
  expect(editedEvent.creatorID).not.toBe(null);
  expect(editedEvent.endTime?.toDateString()).toBe(endTime.toDateString());

  // re-edit and clear the value
  editedEvent = await EditEventAction.create(vc, event, {
    endTime: null,
  }).saveX();
  expect(editedEvent).not.toBe(null);
  expect(editedEvent.name).toBe("fun event");
  expect(editedEvent.location).toBe("location");
  expect(editedEvent.startTime.toDateString()).toBe(date.toDateString());
  expect(editedEvent.creatorID).not.toBe(null);
  expect(editedEvent.endTime).toBe(null);
});

test("delete event", async () => {
  let event = await create(new Date());
  const vc = new IDViewer(event.creatorID);
  await DeleteEventAction.create(vc, event).saveX();

  let loadEvent = await Event.load(vc, event.id);
  expect(loadEvent).toBe(null);
});

describe("validators", () => {
  test("create just startTime", async () => {
    let user = await createUser();

    let action = CreateEventAction.create(loggedOutViewer, {
      name: "fun event",
      creatorID: user.id,
      startTime: new Date(),
      location: "location",
    });

    let valid = await action.valid();
    expect(valid).toBe(true);
  });

  test("create startTime + valid endTime", async () => {
    let user = await createUser();

    let now = new Date();
    let yesterday = new Date(now.getTime() - 86400);
    let action = CreateEventAction.create(loggedOutViewer, {
      name: "fun event",
      creatorID: user.id,
      startTime: yesterday,
      endTime: now,
      location: "location",
    });

    let valid = await action.valid();
    expect(valid).toBe(true);
  });

  test("create startTime + invalid endTime", async () => {
    let user = await createUser();

    let now = new Date();
    let yesterday = new Date(now.getTime() - 86400);
    let action = CreateEventAction.create(loggedOutViewer, {
      name: "fun event",
      creatorID: user.id,
      startTime: now,
      endTime: yesterday,
      location: "location",
    });

    let valid = await action.valid();
    expect(valid).toBe(false);
  });

  test("edit time not changed", async () => {
    let user = await createUser();

    let now = new Date();
    let event = await CreateEventAction.create(loggedOutViewer, {
      name: "fun event",
      creatorID: user.id,
      startTime: now,
      location: "location",
    }).saveX();

    let action = EditEventAction.create(new IDViewer(event.creatorID), event, {
      name: "fun event2",
    });

    let valid = await action.valid();
    expect(valid).toBe(true);
  });

  test("edit time not changed", async () => {
    let event = await create(new Date());

    let action = EditEventAction.create(new IDViewer(event.creatorID), event, {
      name: "fun event2",
    });

    let valid = await action.valid();
    expect(valid).toBe(true);
  });

  test("edit time not changed", async () => {
    let event = await create(new Date());

    let action = EditEventAction.create(new IDViewer(event.creatorID), event, {
      name: "fun event2",
    });

    let valid = await action.valid();
    expect(valid).toBe(true);
  });

  test("edit end time changed to be before existing startTime", async () => {
    let event = await create(new Date());

    let yesterday = new Date(event.startTime.getTime() - 86400);

    let action = EditEventAction.create(new IDViewer(event.creatorID), event, {
      endTime: yesterday,
    });

    let valid = await action.valid();
    expect(valid).toBe(false);
  });

  test("edit start and end time both changed correctly", async () => {
    let event = await create(new Date());

    let yesterday = new Date(event.startTime.getTime() - 86400);
    let yesterdayPlus = new Date(yesterday.getTime() + 3600);

    let action = EditEventAction.create(new IDViewer(event.creatorID), event, {
      startTime: yesterday,
      endTime: yesterdayPlus,
    });

    let valid = await action.valid();
    expect(valid).toBe(true);
  });

  test("edit start changed incorrectly", async () => {
    let event = await create(new Date());

    let yesterday = new Date(event.startTime.getTime() - 86400);
    let yesterdayPlus = new Date(yesterday.getTime() + 3600);

    let action = EditEventAction.create(new IDViewer(event.creatorID), event, {
      startTime: yesterday,
      endTime: yesterdayPlus,
    });

    event = await action.saveX();

    // now changing startTime to be before endTime incorrect...
    action = EditEventAction.create(new IDViewer(event.creatorID), event, {
      startTime: new Date(),
    });
    let valid = await action.valid();
    expect(valid).toBe(false);
  });
});
