import { DB, LoggedOutViewer, IDViewer, Viewer } from "@snowtop/ent";
import { clearAuthHandlers } from "@snowtop/ent/auth";
import { encodeGQLID } from "@snowtop/ent/graphql";
import {
  expectMutation,
  expectQueryFromRoot,
  queryRootConfig,
} from "@snowtop/ent-graphql-tests";
import schema from "../generated/schema";
import CreateUserAction from "../../ent/user/actions/create_user_action";
import { Event } from "../../ent/";
import { randomEmail, randomPhoneNumber } from "../../util/random";
import CreateEventAction, {
  EventCreateInput,
} from "../../ent/event/actions/create_event_action";

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

test("event rsvp status edit", async () => {
  let event = await createEvent({});
  let user = await event.loadCreatorX();

  await expectQueryFromRoot(getConfig(new IDViewer(user.id), event, {}), [
    "viewerRsvpStatus",
    "CAN_RSVP",
  ]);

  await expectMutation(
    {
      mutation: "eventRsvpStatusEdit",
      schema,
      args: {
        eventID: encodeGQLID(event),
        userID: encodeGQLID(user),
        rsvpStatus: "MAYBE",
      },
      viewer: user.viewer,
    },
    ["event.viewerRsvpStatus", "MAYBE"],
  );
});
