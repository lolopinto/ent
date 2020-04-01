import Event from "src/ent/event";
import { ID, Ent, Viewer } from "ent/ent";
import { LoggedOutViewer } from "ent/viewer";
import DB from "ent/db";
import { randomEmail } from "src/util/random";
import CreateUserAction from "src/ent/user/actions/create_user_action";
import CreateEventAction from "src/ent/event/actions/create_event_action";
import EditEventAction from "src/ent/event/actions/edit_event_action";
import DeleteEventAction from "src/ent/event/actions/delete_event_action";

const loggedOutViewer = new LoggedOutViewer();

class IDViewer implements Viewer {
  constructor(public viewerID: ID, private ent: Ent | null = null) {}
  async viewer() {
    return this.ent;
  }
  instanceKey(): string {
    return `idViewer: ${this.viewerID}`;
  }
}

// TODO we need something that does this by default for all tests
afterAll(async () => {
  await DB.getInstance().endPool();
});

async function create(startTime: Date): Promise<Event> {
  let user = await CreateUserAction.create(loggedOutViewer, {
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: randomEmail(),
  }).saveX();

  return await CreateEventAction.create(loggedOutViewer, {
    name: "fun event",
    creatorID: user.id as string,
    startTime: startTime,
    location: "location",
  }).saveX();
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

    // reload the event from the viewer's perspective
    const v = new IDViewer(event.creatorID);
    event = await Event.loadX(v, event.id);
    const creator = await event.loadCreator();
    expect(creator).not.toBe(null);
    expect(creator!.id).toBe(event.creatorID);
  } catch (e) {
    fail(e.message);
  }
});

test("edit event", async () => {
  try {
    let date = new Date();
    let event = await create(date);

    let editedEvent = await EditEventAction.create(loggedOutViewer, event, {
      location: "fun location",
    }).saveX();
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

    let editedEvent = await EditEventAction.create(loggedOutViewer, event, {
      endTime: endTime,
    }).saveX();
    expect(editedEvent).not.toBe(null);
    expect(editedEvent?.name).toBe("fun event");
    expect(editedEvent?.location).toBe("location");
    expect(editedEvent?.startTime.toDateString()).toBe(date.toDateString());
    expect(editedEvent?.creatorID).not.toBe(null);
    expect(editedEvent?.endTime?.toDateString()).toBe(endTime.toDateString());

    // re-edit and clear the value
    editedEvent = await EditEventAction.create(loggedOutViewer, event, {
      endTime: null,
    }).saveX();
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

    await DeleteEventAction.create(loggedOutViewer, event).saveX();

    let loadEvent = await Event.load(loggedOutViewer, event.id);
    expect(loadEvent).toBe(null);
  } catch (e) {
    fail(e.message);
  }
});
