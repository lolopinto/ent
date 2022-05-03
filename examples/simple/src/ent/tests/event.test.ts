import { LoggedOutViewer, IDViewer } from "@snowtop/ent";
import { Event } from "../";
import { randomEmail, randomPhoneNumber } from "../../util/random";
import CreateUserAction from "../user/actions/create_user_action";
import CreateEventAction from "../event/actions/create_event_action";
import EditEventAction from "../event/actions/edit_event_action";
import DeleteEventAction from "../event/actions/delete_event_action";
import CreateAddressAction from "../address/actions/create_address_action";

const loggedOutViewer = new LoggedOutViewer();

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

async function createAddress() {
  return CreateAddressAction.create(loggedOutViewer, {
    streetName: "1 Dr Carlton B Goodlett Pl",
    city: "San Francisco",
    state: "CA",
    zip: "94102",
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
  const creator = await event.loadCreatorX();
  expect(creator.id).toBe(event.creatorID);

  // creator is added as host too
  const hosts = await event.queryHosts().queryEnts();
  expect(hosts.length).toBe(1);
  expect(hosts[0].id).toBe(event.creatorID);

  const [createdEvents, createdEventsEdges] = await Promise.all([
    creator.queryCreatedEvents().queryEnts(),
    creator.queryCreatedEvents().queryEdges(),
  ]);

  expect(createdEvents.length).toBe(1);
  expect(createdEvents[0].id).toBe(event.id);
  expect(createdEventsEdges.length).toBe(1);
  expect(createdEventsEdges[0]).toMatchObject({
    id1: creator.id,
    id1Type: creator.nodeType,
    id2: event.id,
    id2Type: event.nodeType,
  });
});

test("change creator for some reason", async () => {
  let date = new Date();
  let event = await create(date);

  // reload the event from the viewer's perspective
  const v = new IDViewer(event.creatorID);
  event = await Event.loadX(v, event.id);
  const creator = await event.loadCreatorX();
  expect(creator.id).toBe(event.creatorID);

  let [createdEvents, createdEventsEdges] = await Promise.all([
    creator.queryCreatedEvents().queryEnts(),
    creator.queryCreatedEvents().queryEdges(),
  ]);

  expect(createdEvents.length).toBe(1);
  expect(createdEventsEdges.length).toBe(1);

  let newCreator = await createUser();
  let editedEvent = await EditEventAction.create(
    new IDViewer(event.creatorID),
    event,
    {
      creatorID: newCreator.id,
    },
  ).saveX();
  expect(editedEvent.creatorID).toBe(newCreator.id);

  const oldCreator = creator;
  let [createdEvents2, createdEventsEdges2] = await Promise.all([
    oldCreator.queryCreatedEvents().queryEnts(),
    oldCreator.queryCreatedEvents().queryEdges(),
  ]);
  expect(createdEvents2.length).toBe(0);
  expect(createdEventsEdges2.length).toBe(0);

  let [createdEvents3, createdEventsEdges3] = await Promise.all([
    newCreator.queryCreatedEvents().queryEnts(),
    newCreator.queryCreatedEvents().queryEdges(),
  ]);
  expect(createdEvents3.length).toBe(1);
  expect(createdEventsEdges3.length).toBe(1);

  expect(createdEvents3.length).toBe(1);
  expect(createdEvents3[0].id).toBe(event.id);
  expect(createdEventsEdges3.length).toBe(1);
  expect(createdEventsEdges3[0]).toMatchObject({
    id1: newCreator.id,
    id1Type: newCreator.nodeType,
    id2: event.id,
    id2Type: event.nodeType,
  });
});

test("change address", async () => {
  let date = new Date();
  let event = await create(date);
  let address = await createAddress();

  event = await EditEventAction.create(new IDViewer(event.creatorID), event, {
    addressID: address.id,
  }).saveX();
  expect(await event.addressID()).toBe(address.id);

  let [hostedEvents, hostedEventsEdges] = await Promise.all([
    address.queryHostedEvents().queryEnts(),
    address.queryHostedEvents().queryEdges(),
  ]);

  expect(hostedEvents.length).toBe(1);
  expect(hostedEventsEdges.length).toBe(1);

  let newAddress = await createAddress();
  let editedEvent = await EditEventAction.create(
    new IDViewer(event.creatorID),
    event,
    {
      addressID: newAddress.id,
    },
  ).saveX();
  expect(await editedEvent.addressID()).toBe(newAddress.id);

  const oldAddress = address;
  let [hostedEvents2, hostedEventsEdges2] = await Promise.all([
    oldAddress.queryHostedEvents().queryEnts(),
    oldAddress.queryHostedEvents().queryEdges(),
  ]);
  expect(hostedEvents2.length).toBe(0);
  expect(hostedEventsEdges2.length).toBe(0);

  let [hostedEvents3, hostedEventsEdges3] = await Promise.all([
    newAddress.queryHostedEvents().queryEnts(),
    newAddress.queryHostedEvents().queryEdges(),
  ]);
  expect(hostedEvents3.length).toBe(1);
  expect(hostedEventsEdges3.length).toBe(1);

  expect(hostedEvents3.length).toBe(1);
  expect(hostedEvents3[0].id).toBe(event.id);
  expect(hostedEventsEdges3.length).toBe(1);
  expect(hostedEventsEdges3[0]).toMatchObject({
    id1: newAddress.id,
    id1Type: newAddress.nodeType,
    id2: event.id,
    id2Type: event.nodeType,
  });

  // set to null
  editedEvent = await EditEventAction.create(
    new IDViewer(event.creatorID),
    editedEvent,
    {
      addressID: null,
    },
  ).saveX();
  expect(await editedEvent.addressID()).toBe(null);

  let [hostedEvents4, hostedEventsEdges4] = await Promise.all([
    newAddress.queryHostedEvents().queryEnts(),
    newAddress.queryHostedEvents().queryEdges(),
  ]);
  expect(hostedEvents4.length).toBe(0);
  expect(hostedEventsEdges4.length).toBe(0);
});

test("addressID privacy", async () => {
  let date = new Date();
  let event = await create(date);
  let address = await createAddress();

  event = await EditEventAction.create(new IDViewer(event.creatorID), event, {
    addressID: address.id,
  }).saveX();
  expect(await event.addressID()).toBe(address.id);

  const user = await createUser();
  let eventFrom = await Event.loadX(user.viewer, event.id);
  // not connected to event so can't see address
  expect(await eventFrom.addressID()).toBeNull();
  expect(await eventFrom.loadAddress()).toBeNull();

  let action = EditEventAction.create(new IDViewer(event.creatorID), event, {});
  action.builder.addAttending(user);
  await action.saveX();

  eventFrom = await Event.loadX(user.viewer, event.id);
  // can now see address id
  //  expect(await eventFrom.addressID()).toBe(address.id);
  const addressFrom = await eventFrom.loadAddress();
  expect(addressFrom).not.toBeNull();
  expect(addressFrom?.id).toBe(address.id);
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
