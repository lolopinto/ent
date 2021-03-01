import {
  expectMutation,
  expectQueryFromRoot,
} from "@lolopinto/ent-graphql-tests";
import { Event } from "src/ent";
import { DB, ID } from "@lolopinto/ent";
import schema from "src/graphql/schema";
import { encodeGQLID, mustDecodeIDFromGQLID } from "@lolopinto/ent/graphql";
import { createUser } from "src/testutils";
import DeleteEventAction from "src/ent/event/actions/delete_event_action";

afterAll(async () => {
  await DB.getInstance().endPool();
});

test("create event", async () => {
  const user = await createUser();
  await expectMutation(
    {
      viewer: user.viewer,
      mutation: "eventCreate",
      schema,
      args: {
        creatorID: encodeGQLID(user),
        name: "fun event",
      },
    },
    ["event.name", "fun event"],
    ["event.creator.id", encodeGQLID(user)],
  );
});
// need to delete this after test is over since fun-event ends up being used
test("create event with slug", async () => {
  const user = await createUser();
  await expectMutation(
    {
      viewer: user.viewer,
      mutation: "eventCreate",
      schema,
      args: {
        creatorID: encodeGQLID(user),
        name: "fun event",
        slug: "fun-event",
      },
    },
    ["event.name", "fun event"],
    ["event.creator.id", encodeGQLID(user)],
    ["event.slug", "fun-event"],
    [
      "event.id",
      async function(id) {
        id = mustDecodeIDFromGQLID(id);
        const evt = await Event.loadX(user.viewer, id);
        await DeleteEventAction.create(user.viewer, evt).saveX();
      },
    ],
  );
});

test("event slug available", async () => {
  await expectQueryFromRoot(
    {
      root: "eventSlugAvailable",
      schema,
      args: {
        slug: "fun-event",
      },
    },
    [".", true],
  );

  const user = await createUser();
  let eventID: ID = "";
  await expectMutation(
    {
      viewer: user.viewer,
      mutation: "eventCreate",
      schema,
      args: {
        creatorID: encodeGQLID(user),
        name: "fun event",
        slug: "fun-event",
      },
    },
    ["event.name", "fun event"],
    ["event.creator.id", encodeGQLID(user)],
    ["event.slug", "fun-event"],
    [
      "event.id",
      async function(id) {
        eventID = mustDecodeIDFromGQLID(id);
      },
    ],
  );

  await expectQueryFromRoot(
    {
      root: "eventSlugAvailable",
      schema,
      args: {
        slug: "fun-event",
      },
    },
    [".", false],
  );

  const evt = await Event.loadX(user.viewer, eventID);
  await DeleteEventAction.create(user.viewer, evt).saveX();

  await expectQueryFromRoot(
    {
      root: "eventSlugAvailable",
      schema,
      args: {
        slug: "fun-event",
      },
    },
    [".", true],
  );
});

test("query from slug", async () => {
  const user = await createUser();
  let eventID: ID = "";
  await expectMutation(
    {
      viewer: user.viewer,
      mutation: "eventCreate",
      schema,
      args: {
        creatorID: encodeGQLID(user),
        name: "fun event",
        slug: "fun-event",
      },
    },
    ["event.name", "fun event"],
    ["event.creator.id", encodeGQLID(user)],
    ["event.slug", "fun-event"],
    [
      "event.id",
      async function(id) {
        eventID = mustDecodeIDFromGQLID(id);
      },
    ],
  );

  await expectQueryFromRoot(
    {
      root: "event",
      schema,
      args: {
        slug: "fun-event",
      },
    },
    ["name", "fun event"],
    ["slug", "fun-event"],
  );

  const evt = await Event.loadX(user.viewer, eventID);
  await DeleteEventAction.create(user.viewer, evt).saveX();
});
