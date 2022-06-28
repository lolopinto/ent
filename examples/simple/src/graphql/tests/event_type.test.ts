import { Viewer } from "@snowtop/ent";
import { clearAuthHandlers } from "@snowtop/ent/auth";
import { encodeGQLID, mustDecodeIDFromGQLID } from "@snowtop/ent/graphql";
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
import CreateAddressAction from "../../ent/address/actions/create_address_action";
import { LoggedOutExampleViewer, ExampleViewer } from "../../viewer/viewer";

afterEach(() => {
  clearAuthHandlers();
});
const loggedOutViewer = new LoggedOutExampleViewer();

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

async function createUser() {
  return CreateUserAction.create(loggedOutViewer, {
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: randomEmail(),
    phoneNumber: randomPhoneNumber(),
    password: "pa$$w0rd",
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

async function createEvent(options: Partial<EventCreateInput>): Promise<Event> {
  const user = await createUser();

  let vc = new ExampleViewer(user.id);
  return await CreateEventAction.create(vc, {
    name: "event",
    creatorID: user.id,
    startTime: new Date(),
    endTime: null,
    location: "location",
    ...options,
  }).saveX();
}

test("event create nullable addressID", async () => {
  const user = await createUser();
  await expectMutation(
    {
      viewer: new ExampleViewer(user.id),
      schema,
      mutation: "eventCreate",
      nullQueryPaths: ["event.address"],
      args: {
        creatorID: encodeGQLID(user),
        startTime: new Date().toISOString(),
        name: "event",
        eventLocation: "location",
      },
    },
    [
      "event.id",
      async function (id: string) {
        const eventID = mustDecodeIDFromGQLID(id);
        await Event.loadX(new ExampleViewer(user.id), eventID);
      },
    ],
    ["event.creator.id", encodeGQLID(user)],
    ["event.name", "event"],
    ["event.eventLocation", "location"],
    ["event.address.id", null],
  );
});

test("event create addressID passed", async () => {
  const user = await createUser();
  const address = await createAddress();

  await expectMutation(
    {
      viewer: new ExampleViewer(user.id),
      schema,
      mutation: "eventCreate",
      args: {
        creatorID: encodeGQLID(user),
        startTime: new Date().toISOString(),
        name: "event",
        eventLocation: "location",
        addressID: encodeGQLID(address),
      },
    },
    [
      "event.id",
      async function (id: string) {
        const eventID = mustDecodeIDFromGQLID(id);
        await Event.loadX(new ExampleViewer(user.id), eventID);
      },
    ],
    ["event.creator.id", encodeGQLID(user)],
    ["event.name", "event"],
    ["event.eventLocation", "location"],
    ["event.address.id", encodeGQLID(address)],
  );
});

test("event edit", async () => {
  const event = await createEvent({});

  const address = await createAddress();
  await expectMutation(
    {
      viewer: event.viewer,
      schema,
      mutation: "eventEdit",
      args: {
        eventID: encodeGQLID(event),
        name: "event2",
      },
    },
    ["event.id", encodeGQLID(event)],
    ["event.name", "event2"],
  );

  await expectMutation(
    {
      viewer: event.viewer,
      schema,
      mutation: "eventEdit",
      args: {
        eventID: encodeGQLID(event),
        addressID: encodeGQLID(address),
      },
    },
    ["event.id", encodeGQLID(event)],
    ["event.address.id", encodeGQLID(address)],
  );

  await expectMutation(
    {
      viewer: event.viewer,
      schema,
      mutation: "eventEdit",
      nullQueryPaths: ["event.address"],
      args: {
        eventID: encodeGQLID(event),
        addressID: null,
      },
    },
    ["event.id", encodeGQLID(event)],
    ["event.address.id", null],
  );
});

test("query event with startTime and endTime", async () => {
  let event = await createEvent({
    endTime: new Date(Date.now() + 86400),
  });
  let user = await event.loadCreatorX();

  await expectQueryFromRoot(
    getConfig(new ExampleViewer(user.id), event),
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
    getConfig(new ExampleViewer(user.id), event),
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
    getConfig(new ExampleViewer(user.id), event, {
      nullQueryPaths: ["creator"],
    }),
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

  await expectQueryFromRoot(getConfig(new ExampleViewer(user.id), event, {}), [
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
