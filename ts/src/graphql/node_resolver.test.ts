import {
  createUser,
  FakeUser,
  UserCreateInput,
  UserToContactsQuery,
  ContactCreateInput,
  FakeContact,
  getContactBuilder,
  EdgeType,
  getUserBuilder,
  getEventBuilder,
  EventCreateInput,
  SymmetricEdges,
  InverseEdges,
  UserToFriendsQuery,
  FakeEvent,
  UserToEventsAttendingQuery,
  EventToHostsQuery,
  EventToInvitedQuery,
  NodeType,
} from "../../tests/fake_data";
import {
  createTestUser,
  createTestEvent,
  createEdges,
  createAllContacts,
} from "../../tests/fake_data/test_helpers";
import { QueryRecorder } from "../testutils/db_mock";
import { Pool } from "pg";
import { Viewer, ID, Ent, LoadEntOptions, loadEnt } from "../core/ent";
import { EntNodeResolver } from "./node_resolver";
import { IDViewer } from "../core/viewer";

jest.mock("pg");
QueryRecorder.mockPool(Pool);

async function loadEntByType(
  viewer: Viewer,
  type: NodeType,
  id: ID,
): Promise<Ent | null> {
  return loadEnt(viewer, id, getLoaderOptions(type));
}

export function getLoaderOptions(type: NodeType): LoadEntOptions<Ent> {
  switch (type) {
    case NodeType.FakeUser:
      return FakeUser.loaderOptions();
    case NodeType.FakeContact:
      return FakeContact.loaderOptions();
    case NodeType.FakeEvent:
      return FakeEvent.loaderOptions();
  }
}

beforeEach(async () => {
  QueryRecorder.clear();
  await createEdges();
  QueryRecorder.clearQueries();
});

async function testObj(ent: Ent, vc?: Viewer) {
  const resolver = new EntNodeResolver(loadEntByType);
  const encodedID = resolver.encode(ent);
  const decodedID = resolver.decode(encodedID);
  expect(decodedID).toEqual(ent.id);

  vc = vc || new IDViewer(ent.id);

  const decodedObj = await resolver.decodeObj(vc, encodedID);
  expect(decodedObj).not.toBeNull();
  expect(decodedObj!.id).toBe(ent.id);
}

test("user", async () => {
  const user = await createTestUser();

  await testObj(user);
});

test("event", async () => {
  const user = await createTestUser();
  const event = await createTestEvent(user);

  await testObj(event, new IDViewer(user.id));
});

test("contact", async () => {
  const [user, contacts] = await createAllContacts();

  await testObj(contacts[0], new IDViewer(user.id));
});
