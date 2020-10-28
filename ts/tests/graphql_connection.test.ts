import { Pool } from "pg";
import { IDViewer } from "../src/core/viewer";
import { AssocEdge } from "../src/core/ent";
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

class TestConnection {
  private user: FakeUser;
  private contacts: FakeContact[];
  conn: GraphQLEdgeConnection;
  constructor(
    private ents: (contacts: FakeContact[]) => FakeContact[],
    private filter?: (conn: GraphQLEdgeConnection, user: FakeUser) => void,
  ) {}

  async beforeEach() {
    [this.user, this.contacts] = await createAllContacts();
    this.conn = new GraphQLEdgeConnection(
      new IDViewer(this.user.id),
      this.user,
      UserToContactsQuery,
    );
    if (this.filter) {
      this.filter(this.conn, this.user);
    }
    this.contacts = this.ents(this.contacts);
  }

  async testTotalCount() {
    const count = await this.conn.queryTotalCount();
    expect(count).toBe(inputs.length);
  }

  async testNodes() {
    const nodes = await this.conn.queryNodes();
    expect(nodes.length).toBe(this.contacts.length);
    for (let i = 0; i < this.contacts.length; i++) {
      expect(nodes[i].id).toBe(this.contacts[i].id);
    }
  }

  async testEdges() {
    const edges = await this.conn.queryEdges();
    expect(edges.length).toBe(this.contacts.length);
    for (let i = 0; i < this.contacts.length; i++) {
      const edge = edges[i];
      expect(edge.node.id).toBe(this.contacts[i].id);
      expect(edge.edge.id2).toBe(this.contacts[i].id);
    }
  }
}

describe("no filters", () => {
  const filter = new TestConnection((contacts) => contacts.reverse());

  beforeEach(async () => {
    await filter.beforeEach();
  });

  test("totalCount", async () => {
    await filter.testTotalCount();
  });

  test("nodes", async () => {
    await filter.testNodes();
  });

  test("edges", async () => {
    await filter.testEdges();
  });

  test("pagination", async () => {
    const pagination = await filter.conn.queryPageInfo();
    expect(pagination?.hasNextPage).toBe(undefined);
    expect(pagination?.hasPreviousPage).toBe(undefined);
  });
});

describe("filters. firstN", () => {
  const filter = new TestConnection(
    (contacts) => contacts.reverse().slice(0, 2),
    (conn: GraphQLEdgeConnection) => {
      conn.first(2);
    },
  );

  beforeEach(async () => {
    await filter.beforeEach();
  });

  test("totalCount", async () => {
    await filter.testTotalCount();
  });

  test("nodes", async () => {
    await filter.testNodes();
  });

  test("edges", async () => {
    await filter.testEdges();
  });

  test("pagination", async () => {
    const pagination = await filter.conn.queryPageInfo();
    expect(pagination?.hasNextPage).toBe(true);
    expect(pagination?.hasPreviousPage).toBe(undefined);
  });
});

describe("filters. firstN + cursor", () => {
  const filter = new TestConnection(
    // get the next 2
    (contacts) => contacts.reverse().slice(2, 4),
    (conn: GraphQLEdgeConnection, user: FakeUser) => {
      let rows = QueryRecorder.filterData("user_to_contacts_table", (row) => {
        return row.id1 === user.id;
      }).reverse(); // need to reverse
      const cursor = new AssocEdge(rows[1]).getCursor();

      conn.first(2, cursor);
    },
  );

  beforeEach(async () => {
    await filter.beforeEach();
  });

  test("totalCount", async () => {
    await filter.testTotalCount();
  });

  test("nodes", async () => {
    await filter.testNodes();
  });

  test("edges", async () => {
    await filter.testEdges();
  });

  test("pagination", async () => {
    const pagination = await filter.conn.queryPageInfo();
    expect(pagination?.hasNextPage).toBe(true);
    expect(pagination?.hasPreviousPage).toBe(undefined);
  });
});

describe("filters. before  cursor", () => {
  const filter = new TestConnection(
    (contacts) =>
      contacts
        .reverse()
        // get 2, 3
        .slice(2, 4)
        .reverse(),
    (conn: GraphQLEdgeConnection, user: FakeUser) => {
      let rows = QueryRecorder.filterData("user_to_contacts_table", (row) => {
        return row.id1 === user.id;
      }).reverse(); // need to reverse

      // get the 2 before it
      const cursor = new AssocEdge(rows[4]).getCursor();

      conn.last(2, cursor);
    },
  );

  beforeEach(async () => {
    await filter.beforeEach();
  });

  test("totalCount", async () => {
    await filter.testTotalCount();
  });

  test("nodes", async () => {
    await filter.testNodes();
  });

  test("edges", async () => {
    await filter.testEdges();
  });

  test("pagination", async () => {
    const pagination = await filter.conn.queryPageInfo();
    expect(pagination?.hasNextPage).toBe(undefined);
    expect(pagination?.hasPreviousPage).toBe(true);
  });
});

// TODO when not all the ents are loaded e.g. every other one being available
