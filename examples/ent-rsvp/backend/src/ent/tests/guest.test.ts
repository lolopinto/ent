import { GuestGroup } from "src/ent";
import { DB, IDViewer } from "@snowtop/ent";
import { randomEmail } from "src/util/random";
import CreateGuestGroupAction from "../guest_group/actions/create_guest_group_action";
import CreateGuestAction, {
  GuestCreateInput,
} from "src/ent/guest/actions/create_guest_action";
import { Guest } from "../guest";
import { AuthCode } from "../auth_code";
import { createEvent } from "src/testutils";

afterAll(async () => {
  await DB.getInstance().endPool();
});

type input = Pick<GuestCreateInput, "name" | "emailAddress">;
async function createGuestGroup(guests: input[]) {
  const name = guests.map((g) => g.name).join(" ");
  const event = await createEvent();

  const group = await CreateGuestGroupAction.create(
    new IDViewer(event.creatorID),
    {
      invitationName: name,
      eventID: event.id,
    },
  ).saveX();
  expect(group).toBeInstanceOf(GuestGroup);
  return group;
}

const inputs: input[][] = [
  [
    {
      name: "Robb Stark",
      emailAddress: randomEmail(),
    },
    {
      name: "Talisa Stark",
      emailAddress: randomEmail(),
    },
  ],
  [
    {
      name: "Catelyn Stark",
      emailAddress: randomEmail(),
    },
  ],
  [
    {
      name: "Edmure Tully",
      emailAddress: randomEmail(),
    },
    {
      name: "Roslyn Frey",
      emailAddress: randomEmail(),
    },
  ],
];

async function createGuestGroups() {
  const groups = await Promise.all(
    inputs.map(async (guests) => {
      // TODO would be nice to pass this to create guest group and then this is done in a trigger....
      const group = await createGuestGroup(guests);
      await Promise.all(
        guests.map(async (input) => {
          return CreateGuestAction.create(group.viewer, {
            guestGroupID: group.id,
            name: input.name,
            emailAddress: input.emailAddress,
            eventID: group.eventID,
          }).saveX();
        }),
      );
      return group;
    }),
  );
  return groups;
}

test("create guests", async () => {
  const groups = await createGuestGroups();

  const loadedGuests = await groups[0].queryGuests().queryEnts();
  expect(loadedGuests.length).toBe(inputs[0].length);

  // guest can load themselves
  const guestID = loadedGuests[0].id;
  const guest = await Guest.load(new IDViewer(guestID), guestID);
  expect(guest).toBeInstanceOf(Guest);

  if (!guest) {
    fail("impossicant");
  }

  const code = await AuthCode.loadFromGuestID(guest.viewer, guest.id);
  expect(code).toBeInstanceOf(AuthCode);

  if (!code) {
    fail("impossicant");
  }
  expect(code.emailAddress).toBe(guest.emailAddress);
  expect(code.guestID).toBe(guest.id);
  expect(code.sentCode).toBe(false);
});

describe("privacy", () => {
  let groups: GuestGroup[];
  beforeEach(async () => {
    groups = await createGuestGroups();
  });

  test("guests in same groups can load themselves", async () => {
    for (const group of groups) {
      const guests = await group.queryGuests().queryEnts();
      for (const guest of guests) {
        for (const guest2 of guests) {
          // guest needs to be able to load themselves or guests in same guest group
          await Guest.loadX(new IDViewer(guest.id), guest2.id);
        }
      }
    }
  });

  test("guests in different guest group cannot load", async () => {
    let guestsMap = new Map();
    for (const group of groups) {
      const guests = await group.queryGuests().queryEnts();
      guestsMap.set(group.id, guests);
    }

    for (const [guestID, guests] of guestsMap) {
      for (const [guestID2, guests2] of guestsMap) {
        if (guestID === guestID2) {
          continue;
        }

        for (const guest of guests) {
          for (const guest2 of guests2) {
            const loaded = await Guest.load(new IDViewer(guest.id), guest2.id);
            expect(loaded).toBeNull();
          }
        }
      }
    }
  });
});
