import { Event, User, EventActivity } from "src/ent";
import { DB, IDViewer, LoggedOutViewer } from "@lolopinto/ent";
import CreateUserAction from "../user/actions/create_user_action";
import { randomEmail } from "src/util/random";
import CreateEventAction from "../event/actions/create_event_action";
import CreateEventActivityAction from "../event_activity/actions/create_event_activity_action";
import CreateAddressAction from "../address/actions/create_address_action";
import { Address } from "../internal";

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

test("create address", async () => {
  const event = await createEvent();
  const address = await CreateAddressAction.create(event.viewer, {
    street: "1 main street",
    city: "San Francisco",
    state: "CA",
    zipCode: "91111",
    ownerID: event.id,
    ownerType: event.nodeType,
  }).saveX();
  expect(address).toBeInstanceOf(Address);
});
