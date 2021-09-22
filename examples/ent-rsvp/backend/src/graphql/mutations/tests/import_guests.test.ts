import { DB } from "@snowtop/ent";
import { randomEmail } from "src/util/random";
import { expectMutation } from "@snowtop/ent-graphql-tests";
import { encodeGQLID } from "@snowtop/ent/graphql";
import schema from "src/graphql/generated/schema";
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

interface guest {
  name: string;
  emailAddress?: string;
}

interface guestGroup {
  name: string;
  guests: guest[];
}

// headers are name: /additional guest, emailAddress: null don't include it or yes include it
async function doTest(headers: guest[], gs: guestGroup[]) {
  const event = await createEvent();

  let lines: string[] = [];

  let firstLine = ["invitationName"];
  for (const header of headers) {
    firstLine.push(header.name);
    if (header.emailAddress) {
      firstLine.push(header.emailAddress);
    }
  }
  // header...
  lines.push(firstLine.join(", "));

  const m = new Map<string, guestGroup>();
  let expNames: string[] = [];
  for (const g of gs) {
    let line = [g.name];
    if (g.guests.length < 1) {
      throw new Error("at least one guest required");
    }

    for (let i = 0; i < headers.length; i++) {
      const gg = g.guests[i];
      line.push(gg?.name || "");
      if (headers[i].emailAddress) {
        line.push(gg?.emailAddress || "");
      }
    }
    lines.push(line.join(", "));
    m.set(g.name, g);
    expNames.push(g.name);
  }

  const csv = lines.join("\n");
  //  console.log(csv);

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
    ["guestGroups.rawCount", gs.length],
  );

  const guestGroups = await event.queryGuestGroups().queryEnts();
  const names = await Promise.all(
    guestGroups.map(async (g) => {
      const name = g.invitationName;
      const gg = m.get(name);
      expect(gg).toBeDefined();

      const guests = await g.queryGuests().queryEnts();
      expect(guests.length).toEqual(gg?.guests.length);

      expect(guests.map((g) => g.name).sort()).toEqual(
        gg?.guests.map((g) => g.name).sort(),
      );

      return name;
    }),
  );
  expect(names.sort()).toStrictEqual(expNames.sort());
}

test("bulk upload guests", async () => {
  await doTest(
    [
      {
        name: "name",
        emailAddress: "emailAddress",
      },
    ],
    [
      {
        name: "Ms. Arya Stark",
        guests: [
          {
            name: "Arya Stark",
            emailAddress: randomEmail(),
          },
        ],
      },
      {
        name: "Mr. Robb Stark",
        guests: [
          {
            name: "Robb Stark",
            emailAddress: randomEmail(),
          },
        ],
      },
      {
        name: "Mr. Rickon Stark",
        guests: [
          {
            name: "Rickon Stark",
            emailAddress: randomEmail(),
          },
        ],
      },
      {
        name: "Mr. Bran Stark",
        guests: [
          {
            name: "Bran Stark",
            emailAddress: randomEmail(),
          },
        ],
      },
      {
        name: "Mr. Rickon Stark",
        guests: [
          {
            name: "Rickon Stark",
            emailAddress: randomEmail(),
          },
        ],
      },
    ],
  );
});

test("bulk upload. extra guest", async () => {
  await doTest(
    [
      {
        name: "name",
        emailAddress: "emailAddress",
      },
      {
        // Talisa Stark is the only extra guest
        name: "additional guest",
      },
    ],
    [
      {
        name: "Ms. Arya Stark",
        guests: [
          {
            name: "Arya Stark",
            emailAddress: randomEmail(),
          },
        ],
      },
      {
        name: "King and Queen of the north",
        guests: [
          {
            name: "Robb Stark",
            emailAddress: randomEmail(),
          },
          {
            name: "Talisa Stark",
          },
        ],
      },
      {
        name: "Mr. Rickon Stark",
        guests: [
          {
            name: "Rickon Stark",
            emailAddress: randomEmail(),
          },
        ],
      },
      {
        name: "Mr. Bran Stark",
        guests: [
          {
            name: "Bran Stark",
            emailAddress: randomEmail(),
          },
        ],
      },
      {
        name: "Mr. Rickon Stark",
        guests: [
          {
            name: "Rickon Stark",
            emailAddress: randomEmail(),
          },
        ],
      },
    ],
  );
});

test("bulk upload. multiple extra guests", async () => {
  await doTest(
    [
      {
        name: "name",
        emailAddress: "emailAddress",
      },
      {
        name: "additional guest",
        emailAddress: "additional guest email",
      },
      {
        name: "additional guest 2",
        emailAddress: "additional guest 2 email",
      },
    ],
    [
      {
        name: "Ms. Arya Stark",
        guests: [
          {
            name: "Arya Stark",
            emailAddress: randomEmail(),
          },
        ],
      },
      {
        name: "King and Queen of the North",
        guests: [
          {
            name: "Robb Stark",
            emailAddress: randomEmail(),
          },
          {
            name: "Talisa Stark",
          },
          {
            name: "future baby Stark",
            emailAddress: randomEmail(),
          },
        ],
      },
      {
        name: "Mr. Edmure Tully",
        guests: [
          {
            name: "Edmure Tully",
            emailAddress: randomEmail(),
          },
          {
            name: "Roslyn Frey",
          },
        ],
      },
    ],
  );
});
