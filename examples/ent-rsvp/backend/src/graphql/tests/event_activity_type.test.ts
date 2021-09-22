import { expectMutation } from "@snowtop/ent-graphql-tests";
import { IDViewer, DB } from "@snowtop/ent";
import { encodeGQLID } from "@snowtop/ent/graphql";
import { createEvent, createGuestPlus } from "src/testutils";
// this needs to be the last line becasue of load order or at least after src/testutils
import schema from "src/graphql/generated/schema";
import { DateTime } from "luxon";

afterAll(async () => {
  await DB.getInstance().endPool();
});

test("create activity", async () => {
  const event = await createEvent();

  const date = new Date();
  await expectMutation(
    {
      viewer: event.viewer,
      mutation: "eventActivityCreate",
      schema,
      args: {
        eventID: encodeGQLID(event),
        name: "fun activity",
        location: "location",
        startTime: date,
        address: {
          street: "1 main street",
          city: "San Francisco",
          state: "CA",
          zipCode: "91111",
        },
      },
    },
    [
      "eventActivity",
      {
        name: "fun activity",
        event: {
          id: encodeGQLID(event),
        },
        location: "location",
        startTime: DateTime.fromJSDate(date).toUTC().toISO(),
        address: {
          street: "1 main street",
          city: "San Francisco",
          state: "CA",
          zipCode: "91111",
        },
      },
    ],
  );
});

test("rsvp", async () => {
  const { guest, activity } = await createGuestPlus();
  // set attending
  await expectMutation(
    {
      viewer: new IDViewer(guest.id),
      mutation: "eventActivityRsvpStatusEdit",
      schema,
      args: {
        eventActivityID: encodeGQLID(activity),
        rsvpStatus: "ATTENDING",
        guestID: encodeGQLID(guest),
      },
    },
    ["eventActivity.id", encodeGQLID(activity)],
    ["eventActivity.viewerRsvpStatus", "ATTENDING"],
    [
      "eventActivity.attending.edges",
      [
        {
          node: {
            id: encodeGQLID(guest),
          },
          dietaryRestrictions: null,
        },
      ],
    ],
  );

  // set declined
  await expectMutation(
    {
      viewer: new IDViewer(guest.id),
      mutation: "eventActivityRsvpStatusEdit",
      schema,
      args: {
        eventActivityID: encodeGQLID(activity),
        rsvpStatus: "DECLINED",
        guestID: encodeGQLID(guest),
      },
    },
    ["eventActivity.id", encodeGQLID(activity)],
    ["eventActivity.viewerRsvpStatus", "DECLINED"],
  );
});

test("rsvp with dietary restrictions", async () => {
  const { guest, activity } = await createGuestPlus();

  await expectMutation(
    {
      viewer: new IDViewer(guest.id),
      mutation: "eventActivityRsvpStatusEdit",
      schema,
      args: {
        eventActivityID: encodeGQLID(activity),
        rsvpStatus: "ATTENDING",
        guestID: encodeGQLID(guest),
        dietaryRestrictions: "shellfish",
      },
    },
    ["eventActivity.id", encodeGQLID(activity)],
    ["eventActivity.viewerRsvpStatus", "ATTENDING"],
    [
      "eventActivity.attending.edges",
      [
        {
          node: {
            id: encodeGQLID(guest),
          },
          dietaryRestrictions: "shellfish",
        },
      ],
    ],
  );
});
