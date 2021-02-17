import { DB, IDViewer } from "@lolopinto/ent";
import CreateEventAction from "../event/actions/create_event_action";
import CreateAddressAction from "../address/actions/create_address_action";
import { Address } from "../internal";
import EditAddressAction from "../address/actions/edit_address_action";
import DeleteAddressAction from "../address/actions/delete_address_action";
import { createUser, createEvent } from "src/testutils";

afterAll(async () => {
  await DB.getInstance().endPool();
});

async function createAddress() {
  const event = await createEvent();
  const address = await CreateAddressAction.create(event.viewer, {
    street: "1 main street",
    city: "San Francisco",
    state: "CA",
    zipCode: "91111",
    ownerID: event.id,
    ownerType: event.nodeType,
  }).saveX();
  expect(address).toBeInstanceOf(Address);
  return address;
}

test("create address", async () => {
  await createAddress();
});

test("create event and address", async () => {
  const user = await createUser();
  const event = await CreateEventAction.create(new IDViewer(user.id), {
    creatorID: user.id,
    name: `${user.firstName}'s wedding`,
    address: {
      street: "1 main street",
      city: "San Francisco",
      state: "CA",
      zipCode: "91111",
    },
  }).saveX();
  const address = await Address.loadFromOwnerID(event.viewer, event.id);
  expect(address).not.toBeNull();
  expect(address).toBeInstanceOf(Address);
});

describe("edit address", () => {
  test("valid", async () => {
    const address = await createAddress();
    const address2 = await EditAddressAction.create(address.viewer, address, {
      street: "2 main street",
    }).saveX();
    expect(address2.street).toBe("2 main street");
  });

  test("invalid", async () => {
    const [address, user] = await Promise.all([createAddress(), createUser()]);
    try {
      await EditAddressAction.create(new IDViewer(user.id), address, {
        street: "2 main street",
      }).saveX();
    } catch (e) {
      expect(e.message).toMatch(
        /^ent (.+) is not visible for privacy reasons$/,
      );
    }
  });
});

describe("delete address", () => {
  test("valid", async () => {
    const address = await createAddress();
    await DeleteAddressAction.create(address.viewer, address).saveX();
    const loaded = await Address.load(address.viewer, address.id);
    expect(loaded).toBeNull();
  });

  test("invalid", async () => {
    const [address, user] = await Promise.all([createAddress(), createUser()]);
    try {
      await DeleteAddressAction.create(new IDViewer(user.id), address).saveX();
    } catch (e) {
      expect(e.message).toMatch(
        /^ent (.+) is not visible for privacy reasons$/,
      );
    }
  });
});
