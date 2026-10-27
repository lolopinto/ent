import { graphql } from "graphql";
import schema from "src/graphql/generated/schema";
import { encodeGQLID } from "@snowtop/ent/graphql";
import { loadRowX } from "@snowtop/ent/core/ent";
import { Eq } from "@snowtop/ent/core/clause";
import { IDViewer } from "@snowtop/ent";
import CreateAddressAction from "../address/actions/create_address_action";
import { Address } from "../internal";
import EditAddressAction from "../address/actions/edit_address_action";
import DeleteAddressAction from "../address/actions/delete_address_action";
import { createUser, createActivity, createEvent } from "src/testutils";
import CreateEventActivityAction from "../event_activity/actions/create_event_activity_action";

async function createAddress() {
  const activiy = await createActivity();
  const address = await CreateAddressAction.create(activiy.viewer, {
    street: "1 main street",
    city: "San Francisco",
    state: "CA",
    zipCode: "91111",
    ownerId: activiy.id,
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
    eventId: event.id,
    startTime: new Date(),
    location: "fun location",
    address: {
      street: "1 main street",
      city: "San Francisco",
      state: "CA",
      zipCode: "91111",
    },
  }).saveX();
  const address = await Address.loadFromOwnerId(event.viewer, activity.id);
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

test("addressEdit checks the destination owner as well as the current owner", async () => {
  const address = await createAddress();
  const foreignActivity = await createActivity();
  const foreignUser = await createUser();
  const source =
    "mutation($input: AddressEditInput!) { addressEdit(input: $input) { address { id } } }";
  for (const input of [
    { ownerId: encodeGQLID(foreignActivity) },
    { ownerId: encodeGQLID(foreignUser), ownerType: foreignUser.nodeType },
    { ownerType: foreignUser.nodeType },
  ]) {
    const result = await graphql({
      schema,
      source,
      variableValues: { input: { id: encodeGQLID(address), ...input } },
      contextValue: { getViewer: () => address.viewer },
    });
    expect(result.errors?.length).toBeGreaterThan(0);
    const row = await loadRowX({
      ...Address.loaderOptions(),
      clause: Eq("id", address.id),
    });
    expect(row.owner_id).toBe(address.ownerId);
    expect(row.owner_type).toBe(address.ownerType);
  }
});

test("self-owned user addresses can be edited and deleted", async () => {
  const user = await createUser();
  const viewer = new IDViewer(user.id);
  const address = await CreateAddressAction.create(viewer, {
    street: "1 Main",
    city: "SF",
    state: "CA",
    zipCode: "94103",
    ownerId: user.id,
    ownerType: user.nodeType,
  }).saveX();
  const edited = await EditAddressAction.create(viewer, address, {
    street: "2 Main",
  }).saveX();
  expect(edited.street).toBe("2 Main");
  const event = await createEvent(user);
  const activity = await createActivity(undefined, event);
  const moved = await EditAddressAction.create(viewer, edited, {
    ownerId: activity.id,
    ownerType: activity.nodeType,
  }).saveX();
  expect(moved.ownerId).toBe(activity.id);
  const restored = await EditAddressAction.create(viewer, moved, {
    ownerId: user.id,
    ownerType: user.nodeType,
  }).saveX();
  await DeleteAddressAction.create(viewer, restored).saveX();
  expect(await Address.load(viewer, address.id)).toBeNull();
});
