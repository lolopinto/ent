import { Pool } from "pg";
import { IDViewer } from "../src/core/viewer";
import { QueryRecorder } from "../src/testutils/db_mock";
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
} from "./fake_data/";
import {
  inputs,
  getUserInput,
  createTestUser,
  createAllContacts,
  verifyUserToContactEdges,
  verifyUserToContacts,
  createEdges,
} from "./fake_data/test_helpers";
import { GraphQLEdgeConnection } from "../src/graphql/query/edge_connection";
jest.mock("pg");
QueryRecorder.mockPool(Pool);

beforeEach(async () => {
  QueryRecorder.clear();
  await createEdges();
  QueryRecorder.clearQueries();
});

describe("no filters", () => {
  let user: FakeUser;
  let contacts: FakeContact[];
  let conn: GraphQLEdgeConnection;

  beforeEach(async () => {
    [user, contacts] = await createAllContacts();
    conn = new GraphQLEdgeConnection(
      new IDViewer(user.id),
      user,
      UserToContactsQuery,
    );
    contacts = contacts.reverse();
  });

  test("totalCount", async () => {
    const count = await conn.queryTotalCount();
    expect(count).toBe(inputs.length);
  });

  test("nodes", async () => {
    const nodes = await conn.queryNodes();
    expect(nodes.length).toBe(inputs.length);
    for (let i = 0; i < contacts.length; i++) {
      expect(nodes[i].id).toBe(contacts[i].id);
    }
  });

  test("edges", async () => {
    const edges = await conn.queryEdges();
    expect(edges.length).toBe(inputs.length);
    for (let i = 0; i < contacts.length; i++) {
      const edge = edges[i];
      expect(edge.node.id).toBe(contacts[i].id);
      expect(edge.edge.id2).toBe(contacts[i].id);
    }
  });
});
