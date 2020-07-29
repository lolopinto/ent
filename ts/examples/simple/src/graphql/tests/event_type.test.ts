import schema from "src/graphql/schema";
import DB from "ent/core/db";
import CreateUserAction from "src/ent/user/actions/create_user_action";
import { LoggedOutViewer } from "ent/core/viewer";
import Event from "src/ent/event";
import { randomEmail } from "src/util/random";
import { IDViewer } from "ent/core/viewer";
import { expectQueryFromRoot, queryRootConfig } from "src/graphql_test_utils";
import CreateEventAction, {
  EventCreateInput,
} from "src/ent/event/actions/create_event_action";
import { ID, Viewer } from "ent/core/ent";
import { clearAuthHandlers } from "ent/auth";

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
  eventID: ID,
  partialConfig?: Partial<queryRootConfig>,
): queryRootConfig {
  return {
    viewer: viewer,
    schema: schema,
    root: "event",
    args: {
      id: eventID,
    },
    ...partialConfig,
  };
}
async function createEvent(options: Partial<EventCreateInput>): Promise<Event> {
  let user = await CreateUserAction.create(loggedOutViewer, {
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: randomEmail(),
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
  let userID = event.creatorID;

  await expectQueryFromRoot(
    getConfig(new IDViewer(userID), event.id),
    ["id", event.id],
    ["creator.id", userID],
    ["startTime", event.startTime.toISOString()],
    ["endTime", event.endTime!.toISOString()],
    ["name", event.name],
    ["eventLocation", event.location], // graphqlName is eventLocation
  );
});

test("query event with null endTime", async () => {
  let event = await createEvent({});
  let userID = event.creatorID;

  await expectQueryFromRoot(
    getConfig(new IDViewer(userID), event.id),
    ["id", event.id],
    ["creator.id", userID],
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
  }).saveX();

  // can load other events since privacy policy allows it
  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), event.id),
    ["id", event.id],
    ["creator.id", null], // creator is not visible
    ["startTime", event.startTime.toISOString()],
    ["endTime", null],
    ["name", event.name],
    ["eventLocation", event.location], // graphqlName is eventLocation
  );
});
