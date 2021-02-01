import { expectMutation } from "@lolopinto/ent-graphql-tests";
import { IDViewer, DB } from "@lolopinto/ent";
import { encodeGQLID } from "@lolopinto/ent/graphql";
import { createGuestPlus } from "src/testutils";
// this needs to be the last line becasue of load order or at least after src/testutils
import schema from "src/graphql/schema";

afterAll(async () => {
  await DB.getInstance().endPool();
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
