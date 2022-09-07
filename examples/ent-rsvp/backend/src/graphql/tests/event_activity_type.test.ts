import {
  expectMutation,
  expectQueryFromRoot,
} from "@snowtop/ent-graphql-tests";
import { IDViewer } from "@snowtop/ent";
import { encodeGQLID } from "@snowtop/ent/graphql";
import {
  createAndInvitePlusGuests,
  createEvent,
  createGuestPlus,
} from "src/testutils";
// this needs to be the last line becasue of load order or at least after src/testutils
import schema from "src/graphql/generated/schema";
import { DateTime } from "luxon";

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
        addressFromOwner: {
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
        id: encodeGQLID(activity),
        rsvpStatus: "ATTENDING",
        guestID: encodeGQLID(guest),
      },
    },
    ["eventActivity.id", encodeGQLID(activity)],
    // TODO may still need viewer API lol because it's cleaner
    // TODO this needs a flag for other args
    [
      `eventActivity.rsvpStatusFor(id: ${JSON.stringify(guest.id)})`,
      "ATTENDING",
    ],
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
        id: encodeGQLID(activity),
        rsvpStatus: "DECLINED",
        guestID: encodeGQLID(guest),
      },
    },
    ["eventActivity.id", encodeGQLID(activity)],
    [
      `eventActivity.rsvpStatusFor(id: ${JSON.stringify(guest.id)})`,
      "DECLINED",
    ],
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
        id: encodeGQLID(activity),
        rsvpStatus: "ATTENDING",
        guestID: encodeGQLID(guest),
        dietaryRestrictions: "shellfish",
      },
    },
    ["eventActivity.id", encodeGQLID(activity)],
    [
      `eventActivity.rsvpStatusFor(id: ${JSON.stringify(guest.id)})`,
      "ATTENDING",
    ],
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

test("rsvp for other", async () => {
  const [activity, guests] = await createAndInvitePlusGuests(2);
  const self = guests[0];
  const other = guests[1];
  // set attending
  await expectMutation(
    {
      viewer: new IDViewer(self.id),
      mutation: "eventActivityRsvpStatusEdit",
      schema,
      args: {
        id: encodeGQLID(activity),
        rsvpStatus: "ATTENDING",
        guestID: encodeGQLID(other),
      },
    },
    ["eventActivity.id", encodeGQLID(activity)],
    [
      `eventActivity.rsvpStatusFor(id: ${JSON.stringify(other.id)})`,
      "ATTENDING",
    ],
    [
      "eventActivity.attending.edges",
      [
        {
          node: {
            id: encodeGQLID(other),
          },
          dietaryRestrictions: null,
        },
      ],
    ],
  );

  // set declined
  await expectMutation(
    {
      viewer: new IDViewer(self.id),
      mutation: "eventActivityRsvpStatusEdit",
      schema,
      args: {
        id: encodeGQLID(activity),
        rsvpStatus: "DECLINED",
        guestID: encodeGQLID(other),
      },
    },
    ["eventActivity.id", encodeGQLID(activity)],
    [
      `eventActivity.rsvpStatusFor(id: ${JSON.stringify(other.id)})`,
      "DECLINED",
    ],
  );

  // confirm that self is CAN_RSVP
  await expectQueryFromRoot(
    {
      viewer: new IDViewer(self.id),
      root: "node",
      inlineFragmentRoot: "EventActivity",
      schema,
      args: {
        id: encodeGQLID(activity),
      },
    },
    ["id", encodeGQLID(activity)],
    [`rsvpStatusFor(id: ${JSON.stringify(self.id)})`, "CAN_RSVP"],
  );
});
