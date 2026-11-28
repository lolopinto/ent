import { GuestGroup } from "src/ent";
import { IDViewer } from "@snowtop/ent";
import { randomEmail } from "src/util/random";
import CreateGuestGroupAction from "../guest_group/actions/create_guest_group_action";
import CreateGuestAction, {
  GuestCreateInput,
} from "src/ent/guest/actions/create_guest_action";
import { Guest } from "../guest";
import { AuthCode } from "../auth_code";
import { createEvent } from "src/testutils";

type input = Pick<GuestCreateInput, "name" | "emailAddress">;
async function createGuestGroup(guests: input[]) {
  const name = guests.map((g) => g.name).join(" ");
  const event = await createEvent();

  const group = await CreateGuestGroupAction.create(
    new IDViewer(event.creatorId),
    {
      invitationName: name,
      eventId: event.id,
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
            guestGroupId: group.id,
            name: input.name,
            emailAddress: input.emailAddress,
            eventId: group.eventId,
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
    throw new Error("impossicant");
  }

  const code = await AuthCode.loadFromGuestId(guest.viewer, guest.id);
  expect(code).toBeInstanceOf(AuthCode);

  if (!code) {
    throw new Error("impossicant");
  }
  expect(code.emailAddress).toBe(guest.emailAddress);
  expect(code.guestId).toBe(guest.id);
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

test("guests must belong to a group in their event", async () => {
  const { createUser } = await import("src/testutils");
  const owner = await createUser();
  const first = await createEvent(owner);
  const second = await createEvent(owner);
  const foreign = await createEvent();
  const group = await CreateGuestGroupAction.create(second.viewer, {
    invitationName: "Other event",
    eventId: second.id,
  }).saveX();
  const foreignGroup = await CreateGuestGroupAction.create(foreign.viewer, {
    invitationName: "Private",
    eventId: foreign.id,
  }).saveX();
  for (const guestGroupId of [group.id, foreignGroup.id]) {
    await expect(
      CreateGuestAction.create(first.viewer, {
        name: "Wrong event",
        eventId: first.id,
        guestGroupId,
      }).saveX(),
    ).rejects.toThrow(/guest group must belong/);
  }
  const pending = CreateGuestGroupAction.create(second.viewer, {
    invitationName: "Pending",
    eventId: second.id,
  });
  await expect(
    CreateGuestAction.create(first.viewer, {
      name: "Wrong builder",
      eventId: first.id,
      guestGroupId: pending.builder,
    }).saveX(),
  ).rejects.toThrow(/guest group must belong/);
  const guest = await CreateGuestAction.create(second.viewer, {
    name: "Matching",
    eventId: second.id,
    guestGroupId: group.id,
  }).saveX();
  expect(guest.guestGroupId).toBe(group.id);
});

test("guests accept an existing group builder with unchanged event", async () => {
  const { default: EditGroup } = await import(
    "../guest_group/actions/edit_guest_group_action"
  );
  const event = await createEvent();
  const group = await CreateGuestGroupAction.create(event.viewer, {
    invitationName: "Group",
    eventId: event.id,
  }).saveX();
  const edit = EditGroup.create(event.viewer, group, {
    invitationName: "Updated",
  });
  const action = CreateGuestAction.create(event.viewer, {
    name: "Guest",
    eventId: event.id,
    guestGroupId: edit.builder,
  });
  await expect(action.validX()).resolves.toBeUndefined();
});
