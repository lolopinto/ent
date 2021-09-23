import { DB, IDViewer } from "@snowtop/ent";
import CreateAddressAction from "../address/actions/create_address_action";
import { Address } from "../internal";
import EditAddressAction from "../address/actions/edit_address_action";
import DeleteAddressAction from "../address/actions/delete_address_action";
import { createUser, createActivity, createEvent } from "src/testutils";
import CreateEventActivityAction from "../event_activity/actions/create_event_activity_action";

afterAll(async () => {
  await DB.getInstance().endPool();
});

async function createAddress() {
  const activiy = await createActivity();
  const address = await CreateAddressAction.create(activiy.viewer, {
    street: "1 main street",
    city: "San Francisco",
    state: "CA",
    zipCode: "91111",
    ownerID: activiy.id,
    ownerType: activiy.nodeType,
  }).saveX();
  expect(address).toBeInstanceOf(Address);
  return address;
}

test("create address", async () => {
  await createAddress();
});

test("create activity and address", async () => {
  const event = await createEvent();
  const activity = await CreateEventActivityAction.create(event.viewer, {
    name: "fun",
    eventID: event.id,
    startTime: new Date(),
    location: "fun location",
    address: {
      street: "1 main street",
      city: "San Francisco",
      state: "CA",
      zipCode: "91111",
    },
  }).saveX();
  const address = await Address.loadFromOwnerID(event.viewer, activity.id);
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
      expect((e as Error).message).toMatch(
        /Viewer with ID (.+) does not have permission to edit Address/,
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
      expect((e as Error).message).toMatch(
        /Viewer with ID (.+) does not have permission to delete Address/,
      );
    }
  });
});
