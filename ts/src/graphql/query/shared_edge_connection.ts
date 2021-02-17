import { Pool } from "pg";
import { IDViewer, LoggedOutViewer } from "../../core/viewer";
import { RequestContext } from "../../core/context";
import { AssocEdge, Viewer, Data, Ent } from "../../core/ent";
import { QueryRecorder } from "../../testutils/db_mock";
import { advanceBy } from "jest-date-mock";

import { GraphQLEdge, GraphQLEdgeConnection } from "./edge_connection";
import { GraphQLConnectionType } from "./connection_type";
import {
  GraphQLObjectType,
  GraphQLNonNull,
  GraphQLID,
  GraphQLSchema,
  GraphQLString,
  GraphQLFieldMap,
  GraphQLFieldConfigMap,
} from "graphql";
import { GraphQLNodeInterface } from "../builtins/node";
import {
  expectQueryFromRoot,
  queryRootConfig,
} from "../../testutils/ent-graphql-tests";
import {
  FakeUser,
  UserToContactsQuery,
  FakeContact,
  EdgeType,
  getUserBuilder,
  UserToFriendsQuery,
  FakeEvent,
  EventToInvitedQuery,
  UserToHostedEventsQuery,
} from "../../testutils/fake_data/index";
import {
  inputs,
  getUserInput,
  createTestUser,
  createAllContacts,
  createEdges,
  createTestEvent,
} from "../../testutils/fake_data/test_helpers";
import { EdgeQuery } from "../../core/query/query";
import { Edge } from "src/schema";
jest.mock("pg");
QueryRecorder.mockPool(Pool);

class TestConnection<TEdge extends Data> {
  private user: FakeUser;
  private contacts: FakeContact[];
  conn: GraphQLEdgeConnection<TEdge>;
  constructor(
    private getQuery: (
      v: Viewer,
      user: FakeUser,
    ) => EdgeQuery<FakeContact, TEdge>,
    private ents: (contacts: FakeContact[]) => FakeContact[],
    private filter?: (
      conn: GraphQLEdgeConnection<TEdge>,
      user: FakeUser,
    ) => void,
  ) {}

  async beforeEach() {
    [this.user, this.contacts] = await createAllContacts();
    this.conn = new GraphQLEdgeConnection<TEdge>(
      new IDViewer(this.user.id),
      this.user,
      (v, user: FakeUser) => this.getQuery(v, user),
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
      expect(this.conn.query.dataToID(edge.edge)).toBe(this.contacts[i].id);
    }
  }
}

interface options<TEnt extends Ent, TEdge extends Data> {
  getQuery: (v: Viewer, src: Ent) => EdgeQuery<TEnt, TEdge>;
  tableName: string;
  getFilterFn(user: FakeUser): (row: Data) => boolean;
}

export const commonTests = <TEdge extends Data>(
  opts: options<FakeContact, TEdge>,
) => {
  describe("no filters", () => {
    const filter = new TestConnection(
      (v, user: FakeUser) => opts.getQuery(v, user),
      (contacts) => contacts.reverse(),
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
      expect(pagination?.hasPreviousPage).toBe(undefined);
    });
  });

  describe("filters. firstN", () => {
    const filter = new TestConnection(
      (v, user: FakeUser) => opts.getQuery(v, user),
      (contacts) => contacts.reverse().slice(0, 2),
      (conn: GraphQLEdgeConnection<TEdge>) => {
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
      (v, user: FakeUser) => opts.getQuery(v, user),
      // get the next 2
      (contacts) => contacts.reverse().slice(2, 4),
      (conn: GraphQLEdgeConnection<TEdge>, user: FakeUser) => {
        let rows = QueryRecorder.filterData(
          opts.tableName,
          opts.getFilterFn(user),
        ).reverse();
        // need to reverse
        const cursor = conn.query.getCursor(rows[1] as TEdge);

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
      (v, user: FakeUser) => opts.getQuery(v, user),
      (contacts) =>
        contacts
          .reverse()
          // get 2, 3
          .slice(2, 4)
          .reverse(),
      (conn: GraphQLEdgeConnection<TEdge>, user: FakeUser) => {
        let rows = QueryRecorder.filterData(
          opts.tableName,
          opts.getFilterFn(user),
        ).reverse();

        // get the 2 before it
        const cursor = conn.query.getCursor(rows[4] as TEdge);

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
};
