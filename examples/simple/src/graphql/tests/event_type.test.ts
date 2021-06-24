import schema from "src/graphql/schema";
import CreateUserAction from "src/ent/user/actions/create_user_action";
import { DB, LoggedOutViewer, IDViewer, ID, Viewer } from "@snowtop/snowtop-ts";
import { Event } from "src/ent/";
import { randomEmail, randomPhoneNumber } from "src/util/random";
import {
  expectQueryFromRoot,
  queryRootConfig,
} from "@snowtop/snowtop-graphql-tests";
import CreateEventAction, {
  EventCreateInput,
} from "src/ent/event/actions/create_event_action";
import { clearAuthHandlers } from "@snowtop/snowtop-ts/auth";
import { encodeGQLID } from "@snowtop/snowtop-ts/graphql";

// TODO we need something that does this by default for all tests
afterAll(async () => {
  await DB.getInstance().endPool();
});
afterEach(() => {
  clearAuthHandlers();
});
const loggedOutViewer = new LoggedOutViewer();

function getConfig(
  viewer: Viewer,
  event: Event,
  partialConfig?: Partial<queryRootConfig>,
): queryRootConfig {
  return {
    viewer: viewer,
    schema: schema,
    root: "node",
    args: {
      id: encodeGQLID(event),
    },
    inlineFragmentRoot: "Event",
    ...partialConfig,
  };
}

async function createEvent(options: Partial<EventCreateInput>): Promise<Event> {
  let user = await CreateUserAction.create(loggedOutViewer, {
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: randomEmail(),
    phoneNumber: randomPhoneNumber(),
    password: "pa$$w0rd",
  }).saveX();

  let vc = new IDViewer(user.id);
  return await CreateEventAction.create(vc, {
    name: "event",
    creatorID: user.id,
    startTime: new Date(),
    endTime: null,
    location: "location",
    ...options,
  }).saveX();
}

test("query event with startTime and endTime", async () => {
  let event = await createEvent({
    endTime: new Date(Date.now() + 86400),
  });
  let user = await event.loadCreatorX();

  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), event),
    ["id", encodeGQLID(event)],
    ["creator.id", encodeGQLID(user)],
    ["startTime", event.startTime.toISOString()],
    ["endTime", event.endTime!.toISOString()],
    ["name", event.name],
    ["eventLocation", event.location], // graphqlName is eventLocation
  );
});

test("query event with null endTime", async () => {
  let event = await createEvent({});
  let user = await event.loadCreatorX();

  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), event),
    ["id", encodeGQLID(event)],
    ["creator.id", encodeGQLID(user)],
    ["startTime", event.startTime.toISOString()],
    ["endTime", null],
  );
});

test("query event with different viewer", async () => {
  let event = await createEvent({});

  let user = await CreateUserAction.create(loggedOutViewer, {
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: randomEmail(),
    phoneNumber: randomPhoneNumber(),
    password: "pa$$w0rd",
  }).saveX();

  // can load other events since privacy policy allows it
  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), event, { nullQueryPaths: ["creator"] }),
    ["id", encodeGQLID(event)],
    ["creator.id", null], // creator is not visible
    ["startTime", event.startTime.toISOString()],
    ["endTime", null],
    ["name", event.name],
    ["eventLocation", event.location], // graphqlName is eventLocation
  );
});
