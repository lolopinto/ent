import { DB } from "@lolopinto/ent";
import { randomEmail } from "src/util/random";
import { expectMutation } from "@lolopinto/ent-graphql-tests";
import { encodeGQLID } from "@lolopinto/ent/graphql";
import schema from "src/graphql/schema";
import { graphqlUploadExpress } from "graphql-upload";
import { createEvent } from "src/testutils";

// TODO we need something that does this by default for all tests
afterAll(async () => {
  await DB.getInstance().endPool();
});

test("bulk upload. required columns not provided", async () => {
  const event = await createEvent();

  const csv = `invitationName, name
  Ms. Arya Stark, Arya Stark
  Mr. Rickon Stark, Rickon Stark`;

  await expectMutation(
    {
      viewer: event.viewer,
      schema: schema,
      mutation: "importGuests",
      args: {
        eventID: encodeGQLID(event),
        file: Buffer.from(csv),
      },
      disableInputWrapping: true,
      expectedError: /required columns emailAddress not provided/,
      customHandlers: [
        graphqlUploadExpress({
          maxFileSize: 10000000,
          maxFiles: 10,
        }),
      ],
    },
    ["id", encodeGQLID(event)],
  );
});

test("bulk upload guests", async () => {
  const event = await createEvent();

  const csv = `invitationName, name, emailAddress 
  Ms. Arya Stark, Arya Stark, ${randomEmail()}
  Mr. Robb Stark, Robb Stark, ${randomEmail()}
  Mr. Rickon Stark, Rickon Stark, ${randomEmail()}
  Mr. Bran Stark, Bran Stark, ${randomEmail()}
  Mr. Rickon Stark, Rickon Stark, ${randomEmail()}`;

  await expectMutation(
    {
      viewer: event.viewer,
      schema: schema,
      mutation: "importGuests",
      args: {
        eventID: encodeGQLID(event),
        file: Buffer.from(csv),
      },
      disableInputWrapping: true,
      customHandlers: [
        graphqlUploadExpress({
          maxFileSize: 10000000,
          maxFiles: 10,
        }),
      ],
    },
    ["id", encodeGQLID(event)],
    ["guestGroups.rawCount", 5],
  );

  const guestGroups = await event.queryGuestGroups().queryEnts();
  const names = await Promise.all(
    guestGroups.map(async (g) => {
      const count = await g.queryGuests().queryRawCount();
      expect(count).toEqual(1);
      return g.invitationName;
    }),
  );
  expect(names.sort()).toStrictEqual(
    [
      "Ms. Arya Stark",
      "Mr. Robb Stark",
      "Mr. Rickon Stark",
      "Mr. Bran Stark",
      "Mr. Rickon Stark",
    ].sort(),
  );
});

// TODO
test.skip("bulk upload. extra guests", async () => {
  const event = await createEvent();

  // , additional guest firstName, additional guest lastName, additional guest emailAddress
  const csv = `invitationName, name, emailAddress, additional guest firstName, additional guest lastName, additional guest emailAddress
  Ms. Arya Stark, Arya Stark, ${randomEmail()}
  Mr. Robb Stark, Robb Stark, ${randomEmail()}
  Mr. Rickon Stark, Rickon Stark, ${randomEmail()}
  Mr. Bran Stark, Bran Stark, ${randomEmail()}
  Mr. Rickon Stark, Rickon Stark, ${randomEmail()}`;

  await expectMutation(
    {
      viewer: event.viewer,
      schema: schema,
      mutation: "importGuests",
      args: {
        eventID: encodeGQLID(event),
        file: Buffer.from(csv),
      },
      disableInputWrapping: true,
      customHandlers: [
        graphqlUploadExpress({
          maxFileSize: 10000000,
          maxFiles: 10,
        }),
      ],
    },
    ["id", encodeGQLID(event)],
    ["guestGroups.rawCount", 5],
  );

  const guestGroups = await event.queryGuestGroups().queryEnts();
  const names = await Promise.all(
    guestGroups.map(async (g) => {
      const count = await g.queryGuests().queryRawCount();
      expect(count).toEqual(1);
      return g.invitationName;
    }),
  );
  expect(names.sort()).toStrictEqual(
    [
      "Ms. Arya Stark",
      "Mr. Robb Stark",
      "Mr. Rickon Stark",
      "Mr. Bran Stark",
      "Mr. Rickon Stark",
    ].sort(),
  );
});
