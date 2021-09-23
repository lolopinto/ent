import { Pool } from "pg";
import { IDViewer } from "../../core/viewer";
import { Viewer, Data, Ent } from "../../core/base";
import { getCursor } from "../../core/ent";
import { QueryRecorder } from "../../testutils/db_mock";
import { GraphQLEdgeConnection } from "./edge_connection";
import { FakeUser, FakeContact } from "../../testutils/fake_data/index";
import {
  inputs,
  createAllContacts,
} from "../../testutils/fake_data/test_helpers";
import { EdgeQuery } from "../../core/query/query";
jest.mock("pg");
QueryRecorder.mockPool(Pool);

class TestConnection<TEdge extends Data> {
  private user: FakeUser;
  private allContacts: FakeContact[];
  private filteredContacts: FakeContact[] = [];

  conn: GraphQLEdgeConnection<Ent, TEdge>;
  constructor(
    private getQuery: (
      v: Viewer,
      user: FakeUser,
    ) => EdgeQuery<FakeContact, Ent, TEdge>,
    private ents: (contacts: FakeContact[]) => FakeContact[],
    private filter?: (
      conn: GraphQLEdgeConnection<Ent, TEdge>,
      user: FakeUser,
      contacts: FakeContact[],
    ) => void,
  ) {}

  async beforeEach() {
    [this.user, this.allContacts] = await createAllContacts();
    this.allContacts = this.allContacts.reverse();
    this.conn = new GraphQLEdgeConnection<Ent, TEdge>(
      new IDViewer(this.user.id),
      this.user,
      (v, user: FakeUser) => this.getQuery(v, user),
    );
    if (this.filter) {
      this.filter(this.conn, this.user, this.allContacts);
    }
    this.filteredContacts = this.ents(this.allContacts);
  }

  async testTotalCount() {
    const count = await this.conn.queryTotalCount();
    expect(count).toBe(inputs.length);
  }

  async testNodes() {
    const nodes = await this.conn.queryNodes();
    expect(nodes.length).toBe(this.filteredContacts.length);
    for (let i = 0; i < this.filteredContacts.length; i++) {
      expect(nodes[i].id).toBe(this.filteredContacts[i].id);
    }
  }

  async testEdges() {
    const edges = await this.conn.queryEdges();
    expect(edges.length).toBe(this.filteredContacts.length);
    for (let i = 0; i < this.filteredContacts.length; i++) {
      const edge = edges[i];
      expect(edge.node.id).toBe(this.filteredContacts[i].id);
      expect(this.conn.query.dataToID(edge.edge)).toBe(
        this.filteredContacts[i].id,
      );
    }
  }
}

interface options<TEnt extends Ent, TEdge extends Data> {
  getQuery: (v: Viewer, src: Ent) => EdgeQuery<TEnt, Ent, TEdge>;
  tableName: string;
  sortCol: string;
}

export const commonTests = <TEdge extends Data>(
  opts: options<FakeContact, TEdge>,
) => {
  function getCursorFrom(contacts: FakeContact[], idx: number) {
    // we depend on the fact that the same time is used for the edge and created_at
    // based on getContactBuilder
    // so regardless of if we're doing assoc or custom queries, we can get the time
    // from the created_at field
    return getCursor({
      row: contacts[idx],
      col: "createdAt",
      conv: (t) => {
        //sqlite
        if (typeof t === "string") {
          return Date.parse(t);
        }
        return t.getTime();
      },
      // we want the right column to be encoded in the cursor as opposed e.g. time for
      // assoc queries, created_at for index/custom queries
      cursorKey: opts.sortCol,
    });
  }

  describe("no filters", () => {
    const filter = new TestConnection(
      (v, user: FakeUser) => opts.getQuery(v, user),
      (contacts) => contacts,
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
      expect(pagination.hasNextPage).toBe(false);
      expect(pagination.hasPreviousPage).toBe(false);
    });
  });

  describe("filters. firstN", () => {
    const filter = new TestConnection(
      (v, user: FakeUser) => opts.getQuery(v, user),
      (contacts) => contacts.slice(0, 2),
      (conn: GraphQLEdgeConnection<Ent, TEdge>) => {
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
      const [pagination, edges] = await Promise.all([
        filter.conn.queryPageInfo(),
        filter.conn.queryEdges(),
      ]);
      expect(pagination.hasNextPage).toBe(true);
      expect(pagination.hasPreviousPage).toBe(false);
      expect(edges.length).toBe(2);
      expect(edges[0].cursor).toBe(pagination.startCursor);
      expect(edges[1].cursor).toBe(pagination.endCursor);
    });
  });

  describe("filters. firstN + cursor", () => {
    const idx = 1;
    const N = 3;
    const filter = new TestConnection(
      (v, user: FakeUser) => opts.getQuery(v, user),
      // get the next 2
      (contacts) => contacts.slice(idx + 1, idx + N),
      (
        conn: GraphQLEdgeConnection<Ent, TEdge>,
        user: FakeUser,
        contacts: FakeContact[],
      ) => {
        const cursor = getCursorFrom(contacts, idx);
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
      const [pagination, edges] = await Promise.all([
        filter.conn.queryPageInfo(),
        filter.conn.queryEdges(),
      ]);
      expect(pagination.hasNextPage).toBe(true);
      expect(pagination.hasPreviousPage).toBe(false);
      expect(edges.length).toBe(2);
      expect(edges[0].cursor).toBe(pagination.startCursor);
      expect(edges[1].cursor).toBe(pagination.endCursor);
    });
  });

  describe("filters. before  cursor", () => {
    const filter = new TestConnection(
      (v, user: FakeUser) => opts.getQuery(v, user),
      (contacts) => contacts.slice(2, 4).reverse(),
      (
        conn: GraphQLEdgeConnection<Ent, TEdge>,
        user: FakeUser,
        contacts: FakeContact[],
      ) => {
        // get the 2 before it
        const cursor = getCursorFrom(contacts, 4);

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
      const [pagination, edges] = await Promise.all([
        filter.conn.queryPageInfo(),
        filter.conn.queryEdges(),
      ]);
      expect(pagination.hasNextPage).toBe(false);
      expect(pagination.hasPreviousPage).toBe(true);
      expect(edges.length).toBe(2);
      expect(edges[0].cursor).toBe(pagination.startCursor);
      expect(edges[1].cursor).toBe(pagination.endCursor);
    });
  });

  describe("no source", () => {
    test("no filter", async () => {
      const [user, allContacts] = await createAllContacts();

      const conn = new GraphQLEdgeConnection<FakeContact, TEdge>(
        new IDViewer(user.id),
        (v) => opts.getQuery(v, user),
      );
      allContacts.reverse();

      const nodes = await conn.queryNodes();
      expect(nodes.length).toBe(allContacts.length);
      for (let i = 0; i < allContacts.length; i++) {
        expect(nodes[i].id).toBe(allContacts[i].id);
      }

      const pagination = await conn.queryPageInfo();
      expect(pagination.hasNextPage).toBe(false);
      expect(pagination.hasPreviousPage).toBe(false);
    });

    test("with filter", async () => {
      const [user, allContacts] = await createAllContacts();

      const conn = new GraphQLEdgeConnection<Ent, TEdge>(
        new IDViewer(user.id),
        (v) => opts.getQuery(v, user).first(2),
      );
      allContacts.reverse();
      const filtered = allContacts.slice(0, 2);

      const nodes = await conn.queryNodes();
      expect(nodes.length).toBe(filtered.length);
      for (let i = 0; i < filtered.length; i++) {
        expect(nodes[i].id).toBe(filtered[i].id);
      }

      const pagination = await conn.queryPageInfo();
      expect(pagination.hasNextPage).toBe(true);
      expect(pagination.hasPreviousPage).toBe(false);
    });
  });
};
