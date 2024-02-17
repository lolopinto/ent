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
  createGuests,
} from "src/testutils";
// this needs to be the last line becasue of load order or at least after src/testutils
import schema from "src/graphql/generated/schema";
import { DateTime } from "luxon";
import CreateGuestGroupAction from "src/ent/guest_group/actions/create_guest_group_action";

test("create activity", async () => {
  const event = await createEvent();

  const date = new Date();
  await expectMutation(
    {
      viewer: event.viewer,
      mutation: "eventActivityCreate",
      schema,
      args: {
        eventId: encodeGQLID(event),
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

test("canViewerDo", async () => {
  const [activity, guests] = await createAndInvitePlusGuests(2);
  const self = guests[0];
  const other = guests[1];

  const group2 = await CreateGuestGroupAction.create(activity.viewer, {
    invitationName: "people",
    eventId: activity.eventId,
  }).saveX();

  const guests2 = await createGuests(group2, 2);

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
    // can't invite anyone
    ["canViewerDo.eventActivityAddInvite", false],
    // can change rsvp status for self
    [
      `canViewerDo {self: eventActivityRsvpStatusEdit(rsvpStatus: ATTENDING, guestID: "${encodeGQLID(
        self,
      )}") }`,
      true,
      "canViewerDo.self",
    ],
    // can change rsvp status for other
    [
      `canViewerDo {other: eventActivityRsvpStatusEdit(rsvpStatus: ATTENDING, guestID: "${encodeGQLID(
        other,
      )}") }`,
      true,
      "canViewerDo.other",
    ],

    // can't change rsvp status for other group
    [
      `canViewerDo {other_guest: eventActivityRsvpStatusEdit(rsvpStatus: ATTENDING, guestID: "${encodeGQLID(
        guests2[0],
      )}") }`,
      false,
      "canViewerDo.other_guest",
    ],
  );

  await expectQueryFromRoot(
    {
      viewer: activity.viewer,
      root: "node",
      inlineFragmentRoot: "EventActivity",
      schema,
      args: {
        id: encodeGQLID(activity),
      },
    },
    ["id", encodeGQLID(activity)],
    // creator can invite
    ["canViewerDo.eventActivityAddInvite", true],
    // can't change rsvp for anyone. in actual fact, should be able to do so if this was a real events system but we don't support that

    [
      `canViewerDo {self: eventActivityRsvpStatusEdit(rsvpStatus: ATTENDING, guestID: "${encodeGQLID(
        self,
      )}") }`,
      false,
      "canViewerDo.self",
    ],

    [
      `canViewerDo {other: eventActivityRsvpStatusEdit(rsvpStatus: ATTENDING, guestID: "${encodeGQLID(
        other,
      )}") }`,
      false,
      "canViewerDo.other",
    ],

    [
      `canViewerDo {other_guest: eventActivityRsvpStatusEdit(rsvpStatus: ATTENDING, guestID: "${encodeGQLID(
        guests2[0],
      )}") }`,
      false,
      "canViewerDo.other_guest",
    ],
  );
});
