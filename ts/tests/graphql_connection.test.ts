import { Pool } from "pg";
import { IDViewer, LoggedOutViewer } from "../src/core/viewer";
import { RequestContext } from "../src/core/context";
import { AssocEdge } from "../src/core/ent";
import { QueryRecorder } from "../src/testutils/db_mock";
import { advanceBy } from "jest-date-mock";
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
} from "./fake_data/";
import {
  inputs,
  getUserInput,
  createTestUser,
  createAllContacts,
  createEdges,
  createTestEvent,
} from "./fake_data/test_helpers";
import {
  GraphQLEdge,
  GraphQLEdgeConnection,
} from "../src/graphql/query/edge_connection";
import { GraphQLConnectionType } from "../src/graphql/query/connection_type";
import {
  GraphQLObjectType,
  GraphQLNonNull,
  GraphQLID,
  GraphQLSchema,
  GraphQLString,
  GraphQLFieldMap,
  GraphQLFieldConfigMap,
} from "graphql";
import { GraphQLNodeInterface } from "../src/graphql/builtins/node";
import {
  expectQueryFromRoot,
  queryRootConfig,
} from "../src/testutils/ent-graphql-tests";
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

describe("not all ents visible", () => {
  let user: FakeUser;
  let event: FakeEvent;
  let users: FakeUser[];
  let conn: GraphQLEdgeConnection;
  let friendCount: number;
  // let's make it big. 20 people
  let friendsInput = [...inputs, ...inputs, ...inputs, ...inputs];
  beforeEach(async () => {
    friendCount = 0;
    user = await createTestUser();
    event = await createTestEvent(user);

    let promises: Promise<FakeUser>[] = [];
    for (let i = 0; i < friendsInput.length; i++) {
      advanceBy(100);
      let input = friendsInput[i];
      const builder = getUserBuilder(user.viewer, getUserInput(input));
      if (i % 2 == 1) {
        builder.orchestrator.addOutboundEdge(
          user.id,
          EdgeType.UserToFriends,
          "User",
        );
        friendCount++;
      }
      // invite user to events
      builder.orchestrator.addInboundEdge(
        event.id,
        EdgeType.EventToInvited,
        "User",
        {
          // just to make times deterministic so that tests can consistently work
          time: new Date(),
        },
      );
      promises.push(builder.saveX());
    }
    users = await Promise.all(promises);

    // only few of the users invited as friends
    const vc = new IDViewer(user.id);
    const friendsMap = await UserToFriendsQuery.query(vc, user.id).queryEdges();
    expect(friendsMap.get(user.id)?.length).toBe(friendCount);

    // everyone  invited to event
    const invitedEventsMap = await EventToInvitedQuery.query(
      vc,
      event.id,
    ).queryEdges();
    expect(invitedEventsMap.get(event.id)?.length).toBe(friendsInput.length);

    resetConn();
  });

  function resetConn() {
    conn = new GraphQLEdgeConnection(
      new IDViewer(user.id),
      event,
      EventToInvitedQuery,
    );
  }

  test("totalCount", async () => {
    const count = await conn.queryTotalCount();
    expect(count).toBe(users.length);
  });

  test("nodes", async () => {
    const nodes = await conn.queryNodes();
    expect(nodes.length).toBe(friendCount);
  });

  test("edges", async () => {
    const edges = await conn.queryEdges();
    expect(edges.length).toBe(friendCount);
  });

  test("pagination", async () => {
    const edgesMap = await EventToInvitedQuery.query(
      new LoggedOutViewer(),
      event,
    ).queryEdges();
    const edges = edgesMap.get(event.id) || [];

    async function verify(
      first: number,
      length: number,
      hasNextpage: boolean | undefined,
      index?: number,
    ) {
      let cursor: string | undefined;
      if (index) {
        cursor = edges[index].getCursor();
      }
      resetConn();
      conn.first(first, cursor);
      const [pagination, gqlEdges, nodes] = await Promise.all([
        conn.queryPageInfo(),
        conn.queryEdges(),
        conn.queryNodes(),
      ]);
      expect(pagination.hasNextPage, `${index}`).toBe(hasNextpage);
      expect(gqlEdges.length, `${index}`).toBe(length);
      expect(nodes.length, `${index}`).toBe(length);
    }
    // TODO build exponential backoff into EntQuery so this isn't needed
    // but this is how it is for now
    await verify(1, 1, true);
    await verify(2, 1, true);
    await verify(2, 1, true, 0);
    await verify(2, 1, true, 2);
    await verify(2, 1, true, 4);
    await verify(2, 1, true, 6);
    await verify(2, 1, true, 8);
    await verify(2, 1, true, 10);
    await verify(2, 1, true, 12);
    await verify(2, 1, true, 14);
    await verify(2, 1, true, 16);
    await verify(2, 1, undefined, 17);
  });
});

test("custom edge fields", async () => {
  let userType = new GraphQLObjectType({
    name: "User",
    fields: {
      id: {
        type: GraphQLNonNull(GraphQLID),
      },
      firstName: {
        type: GraphQLString,
      },
      lastName: {
        type: GraphQLString,
      },
    },
    interfaces: [GraphQLNodeInterface],
    isTypeOf(obj, _context: RequestContext) {
      return obj instanceof FakeUser;
    },
  });

  let eventType = new GraphQLObjectType({
    name: "Event",
    fields: {
      id: {
        type: GraphQLNonNull(GraphQLID),
      },
    },
    interfaces: [GraphQLNodeInterface],
    isTypeOf(obj, _context: RequestContext) {
      return obj instanceof FakeEvent;
    },
  });

  const conn = new GraphQLConnectionType("CustomEdge", eventType);

  const length = (m: GraphQLFieldMap<any, any>) => {
    let count = 0;
    for (let k in m) {
      count++;
    }
    return count;
  };
  const fields = conn.edgeType.getFields();
  // default.
  expect(length(fields)).toBe(2);
  expect(fields["node"]).toBeDefined();
  expect(fields["cursor"]).toBeDefined();

  const conn2 = new GraphQLConnectionType("CustomEdge", eventType, {
    fields: (): GraphQLFieldConfigMap<GraphQLEdge, RequestContext> => ({
      bar: {
        type: GraphQLString,
        resolve() {
          return "customEdgeData";
        },
      },
    }),
  });

  const fields2 = conn2.edgeType.getFields();
  expect(length(fields2)).toBe(3);
  expect(fields2["bar"]).toBeDefined();
  expect(fields2["node"]).toBeDefined();
  expect(fields2["cursor"]).toBeDefined();

  const user = await createTestUser();
  const event = await createTestEvent(user);

  let rootQuery = new GraphQLObjectType({
    name: "RootQueryType",
    fields: {
      conn: {
        type: conn2,
        async resolve(_source, { id }, context: RequestContext) {
          return new GraphQLEdgeConnection(
            new IDViewer(user.id),
            user,
            UserToHostedEventsQuery,
          );
        },
      },
    },
  });

  let schema = new GraphQLSchema({
    query: rootQuery,
    types: [userType, eventType],
  });

  let cfg: queryRootConfig = {
    schema: schema,
    root: "conn",
    viewer: new IDViewer(user.id),
    args: {},
  };

  await expectQueryFromRoot(cfg, [
    "edges",
    [
      {
        node: {
          id: event.id,
        },
        bar: "customEdgeData",
      },
    ],
  ]);
});
