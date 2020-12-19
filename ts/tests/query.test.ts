import { Pool } from "pg";
import { QueryRecorder } from "../src/testutils/db_mock";
import {
  AssocEdge,
  Data,
  ID,
  Ent,
  Viewer,
  DefaultLimit,
} from "../src/core/ent";
import { EdgeQuery, EdgeQueryCtr } from "../src/core/query";
import { IDViewer, LoggedOutViewer } from "../src/core/viewer";
import { advanceBy } from "jest-date-mock";
import {
  FakeUser,
  UserToContactsQuery,
  FakeContact,
  EdgeType,
  getUserBuilder,
  UserToFriendsQuery,
  FakeEvent,
  UserToEventsAttendingQuery,
  EventToHostsQuery,
  NodeType,
} from "./fake_data/";
import {
  inputs,
  getUserInput,
  createTestUser,
  createAllContacts,
  verifyUserToContactEdges,
  verifyUserToContacts,
  createEdges,
  createTestEvent,
} from "./fake_data/test_helpers";

jest.mock("pg");
QueryRecorder.mockPool(Pool);

beforeEach(async () => {
  QueryRecorder.clear();
  await createEdges();
  QueryRecorder.clearQueries();
});

class TestQueryFilter {
  private contacts: FakeContact[] = [];
  private user: FakeUser;
  constructor(
    private filter: (
      q: UserToContactsQuery,
      user: FakeUser,
    ) => UserToContactsQuery,
    private ents: (contacts: FakeContact[]) => FakeContact[],
  ) {}

  async beforeEach() {
    [this.user, this.contacts] = await createAllContacts();
    this.contacts = this.ents(this.contacts);
    QueryRecorder.clearQueries();
  }

  getQuery(viewer?: Viewer) {
    return this.filter(
      UserToContactsQuery.query(viewer || new LoggedOutViewer(), this.user),
      this.user,
    );
  }

  async testIDs() {
    const idsMap = await this.getQuery().queryIDs();
    this.verifyIDs(idsMap);
  }

  private verifyIDs(idsMap: Map<ID, ID[]>) {
    expect(idsMap.size).toBe(1);

    expect(idsMap.get(this.user.id)).toStrictEqual(
      this.contacts.map((contact) => contact.id),
    );
  }

  // rawCount isn't affected by filters...
  async testRawCount() {
    const countMap = await this.getQuery().queryRawCount();
    this.verifyRawCount(countMap);
  }

  private verifyRawCount(countMap: Map<ID, number>) {
    expect(countMap.size).toBe(1);

    expect(countMap.get(this.user.id)).toBe(inputs.length);
  }

  async testCount() {
    const countMap = await this.getQuery().queryCount();
    this.verifyCount(countMap);
  }

  private verifyCount(countMap: Map<ID, number>) {
    expect(countMap.size).toBe(1);

    expect(countMap.get(this.user.id)).toBe(this.contacts.length);
  }

  async testEdges() {
    const edgesMap = await this.getQuery().queryEdges();
    this.verifyEdges(edgesMap);
  }

  private verifyEdges(edgesMap: Map<ID, AssocEdge[]>) {
    expect(edgesMap.size).toBe(1);

    verifyUserToContactEdges(this.user, edgesMap, this.contacts);
  }

  async testEnts() {
    const entsMap = await this.getQuery(new IDViewer(this.user.id)).queryEnts();
    this.verifyEnts(entsMap);
  }

  private verifyEnts(entsMap: Map<ID, FakeContact[]>) {
    expect(entsMap.size).toBe(1);
    verifyUserToContacts(this.user, entsMap, this.contacts);
  }

  async testAll() {
    const query = this.getQuery(new IDViewer(this.user.id));
    const [
      edgesMap,
      countMap,
      entsMap,
      idsMap,
      rawCountMap,
    ] = await Promise.all([
      query.queryEdges(),
      query.queryCount(),
      query.queryEnts(),
      query.queryIDs(),
      query.queryRawCount(),
    ]);
    this.verifyCount(countMap);
    this.verifyEdges(edgesMap);
    this.verifyIDs(idsMap);
    this.verifyRawCount(rawCountMap);
    this.verifyEnts(entsMap);
  }
}

describe("simple queries", () => {
  const filter = new TestQueryFilter(
    (q: UserToContactsQuery) => {
      // no filters
      return q;
    },
    (contacts: FakeContact[]) => {
      // nothing to do here
      // reverse because edges are most recent first
      return contacts.reverse();
    },
  );

  beforeEach(async () => {
    await filter.beforeEach();
  });

  test("ids", async () => {
    await filter.testIDs();
    verifyQuery({});
  });

  test("rawCount", async () => {
    await filter.testRawCount();
    verifyCountQuery({});
  });

  test("count", async () => {
    await filter.testCount();
    verifyQuery({});
  });

  test("edges", async () => {
    await filter.testEdges();
    verifyQuery({});
  });

  test("ents", async () => {
    await filter.testEnts();
    verifyQuery({ length: 2 });
  });

  test("all", async () => {
    await filter.testAll();
  });
});

const N = 2;
function firstNFilter(q: UserToContactsQuery) {
  return q.first(N);
}

function firstNEntsFilter(contacts: FakeContact[]) {
  return contacts.reverse().slice(0, N);
}

function verifyQuery({
  length = 1,
  numQueries = 1,
  limit = DefaultLimit,
  disablePaginationBump = false,
}) {
  const queries = QueryRecorder.getCurrentQueries();
  expect(queries.length).toBe(length);
  for (let i = 0; i < numQueries; i++) {
    const query = queries[i];
    let expLimit = disablePaginationBump ? limit : limit + 1;
    expect(query.qs?.whereClause, `${i}`).toBe(
      // default limit
      `id1 = $1 AND edge_type = $2 ORDER BY time DESC LIMIT ${expLimit}`,
    );
  }
}

function verifyCountQuery({ length = 1, numQueries = 1 }) {
  const queries = QueryRecorder.getCurrentQueries();
  expect(queries.length).toBe(length);
  for (let i = 0; i < numQueries; i++) {
    const query = queries[i];
    expect(query.qs?.whereClause).toBe(`id1 = $1 AND edge_type = $2`);
  }
}

function verifyFirstAfterCursorQuery(length: number = 1) {
  const queries = QueryRecorder.getCurrentQueries();
  expect(queries.length).toBe(length);
  const query = queries[0];
  expect(query.qs?.whereClause).toBe(
    `id1 = $1 AND edge_type = $2 AND time < $3 ORDER BY time DESC LIMIT 4`,
  );
}

function verifyLastBeforeCursorQuery(length: number = 1) {
  const queries = QueryRecorder.getCurrentQueries();
  expect(queries.length).toBe(length);
  const query = queries[0];
  expect(query.qs?.whereClause).toBe(
    // extra fetched for pagination
    `id1 = $1 AND edge_type = $2 AND time > $3 ORDER BY time ASC LIMIT 4`,
  );
}

// for now, this always applies in sql. todo may not always be the case.
// see comment in FirstFilter
describe("first. no cursor", () => {
  const N = 2;
  const filter = new TestQueryFilter(
    (q: UserToContactsQuery) => {
      return q.first(N);
    },
    (contacts: FakeContact[]) => {
      return contacts.reverse().slice(0, N);
    },
  );

  beforeEach(async () => {
    await filter.beforeEach();
  });

  test("ids", async () => {
    await filter.testIDs();
    verifyQuery({ limit: 2 });
  });

  test("rawCount", async () => {
    await filter.testRawCount();
    verifyCountQuery({});
  });

  test("count", async () => {
    await filter.testCount();
    verifyQuery({ limit: 2 });
  });

  test("edges", async () => {
    await filter.testEdges();
    verifyQuery({ limit: 2 });
  });

  test("ents", async () => {
    await filter.testEnts();
    // 2nd query to load the ents
    verifyQuery({ length: 2, limit: 2 });
  });

  test("all", async () => {
    await filter.testAll();
  });
});

describe("last", () => {
  const N = 2;
  const filter = new TestQueryFilter(
    (q: UserToContactsQuery) => {
      return q.last(N);
    },
    (contacts: FakeContact[]) => {
      // take the first N and then reverse it to get the last N in the right order
      return contacts.slice(0, N).reverse();
    },
  );

  beforeEach(async () => {
    await filter.beforeEach();
  });

  test("ids", async () => {
    await filter.testIDs();
    verifyQuery({ disablePaginationBump: true });
  });

  test("rawCount", async () => {
    await filter.testRawCount();
    verifyCountQuery({});
  });

  test("count", async () => {
    await filter.testCount();
    verifyQuery({ disablePaginationBump: true });
  });

  test("edges", async () => {
    await filter.testEdges();
    verifyQuery({ disablePaginationBump: true });
  });

  test("ents", async () => {
    await filter.testEnts();
    verifyQuery({ length: 2, disablePaginationBump: true });
  });

  test("all", async () => {
    await filter.testAll();
  });
});

describe("first after cursor", () => {
  const idx = 2;
  const N = 3;
  let rows: Data[] = [];
  const filter = new TestQueryFilter(
    (q: UserToContactsQuery, user: FakeUser) => {
      rows = QueryRecorder.filterData("user_to_contacts_table", (row) => {
        return row.id1 === user.id;
      }).reverse(); // need to reverse
      const cursor = new AssocEdge(rows[idx]).getCursor();

      return q.first(N, cursor);
    },
    (contacts: FakeContact[]) => {
      // < check so we shouldn't get that index
      return contacts.reverse().slice(idx + 1, idx + N);
    },
  );

  beforeEach(async () => {
    await filter.beforeEach();
  });

  test("ids", async () => {
    await filter.testIDs();
    verifyFirstAfterCursorQuery();
  });

  test("rawCount", async () => {
    await filter.testRawCount();
    verifyCountQuery({});
  });

  test("count", async () => {
    await filter.testCount();
    verifyFirstAfterCursorQuery();
  });

  test("edges", async () => {
    await filter.testEdges();
    verifyFirstAfterCursorQuery();
  });

  test("ents", async () => {
    await filter.testEnts();
    verifyFirstAfterCursorQuery(2);
  });

  test("all", async () => {
    await filter.testAll();
  });
});

test("first. after each cursor", async () => {
  let [user, contacts] = await createAllContacts();
  contacts = contacts.reverse();
  const edgesMap = await UserToContactsQuery.query(
    new LoggedOutViewer(),
    user.id,
  ).queryEdges();
  const edges = edgesMap.get(user.id) || [];

  async function verify(
    i: number,
    hasEdge: boolean,
    hasNextPage: boolean,
    cursor?: string,
  ) {
    const query = UserToContactsQuery.query(new LoggedOutViewer(), user.id);
    const newEdgeMap = await query.first(1, cursor).queryEdges();

    const newEdges = newEdgeMap.get(user.id) || [];
    const pagination = query.paginationInfo().get(user.id);
    if (hasEdge) {
      expect(newEdges.length, `${i}`).toBe(1);
      expect(newEdges[0], `${i}`).toStrictEqual(edges[i]);
    } else {
      expect(newEdges.length, `${i}`).toBe(0);
    }

    if (hasNextPage) {
      expect(pagination?.hasNextPage).toBe(true);
      expect(pagination?.hasPreviousPage).toBe(undefined);
    } else {
      expect(pagination?.hasNextPage).toBe(undefined);
      expect(pagination?.hasNextPage).toBe(undefined);
    }
  }

  await verify(0, true, true, undefined);
  await verify(1, true, true, edges[0].getCursor());
  await verify(2, true, true, edges[1].getCursor());
  await verify(3, true, true, edges[2].getCursor());
  await verify(4, true, false, edges[3].getCursor());
  await verify(5, false, false, edges[4].getCursor());
});

describe("last. before cursor", () => {
  const idx = 2;
  const N = 3;
  let rows: Data[] = [];
  const filter = new TestQueryFilter(
    (q: UserToContactsQuery, user: FakeUser) => {
      rows = QueryRecorder.filterData("user_to_contacts_table", (row) => {
        return row.id1 === user.id;
      }).reverse(); // need to reverse
      const cursor = new AssocEdge(rows[idx]).getCursor();

      return q.last(N, cursor);
    },
    (contacts: FakeContact[]) => {
      // > check so we don't want that index
      return contacts
        .reverse()
        .slice(0, idx)
        .reverse(); // because of order returned
    },
  );

  beforeEach(async () => {
    await filter.beforeEach();
  });

  test("ids", async () => {
    await filter.testIDs();
    verifyLastBeforeCursorQuery();
  });

  test("rawCount", async () => {
    await filter.testRawCount();
    verifyCountQuery({});
  });

  test("count", async () => {
    await filter.testCount();
    verifyLastBeforeCursorQuery();
  });

  test("edges", async () => {
    await filter.testEdges();
    verifyLastBeforeCursorQuery();
  });

  test("ents", async () => {
    await filter.testEnts();
    verifyLastBeforeCursorQuery(2);
  });

  test("all", async () => {
    await filter.testAll();
  });
});

test("last. before each cursor", async () => {
  let [user, contacts] = await createAllContacts();
  contacts = contacts.reverse();
  const edgesMap = await UserToContactsQuery.query(
    new LoggedOutViewer(),
    user.id,
  ).queryEdges();
  const edges = edgesMap.get(user.id) || [];

  async function verify(
    i: number,
    hasEdge: boolean,
    hasPreviousPage: boolean,
    cursor?: string,
  ) {
    const query = UserToContactsQuery.query(new LoggedOutViewer(), user.id);
    const newEdgeMap = await query.last(1, cursor).queryEdges();

    const newEdges = newEdgeMap.get(user.id) || [];
    const pagination = query.paginationInfo().get(user.id);
    if (hasEdge) {
      expect(newEdges.length, `${i}`).toBe(1);
      expect(newEdges[0], `${i}`).toStrictEqual(edges[i]);
    } else {
      expect(newEdges.length, `${i}`).toBe(0);
    }

    if (hasPreviousPage) {
      expect(pagination?.hasPreviousPage).toBe(true);
      expect(pagination?.hasNextPage).toBe(undefined);
    } else {
      expect(pagination?.hasPreviousPage).toBe(undefined);
      expect(pagination?.hasNextPage).toBe(undefined);
    }
  }

  await verify(4, true, true, undefined);
  await verify(3, true, true, edges[4].getCursor());
  await verify(2, true, true, edges[3].getCursor());
  await verify(1, true, true, edges[2].getCursor());
  await verify(0, true, false, edges[1].getCursor());
  await verify(-1, false, false, edges[0].getCursor());
});

class MultiIDsTestQueryFilter {
  dataz: [FakeUser, FakeContact[]][] = [];
  constructor(
    private filter: (q: UserToContactsQuery) => UserToContactsQuery,
    private ents: (contacts: FakeContact[]) => FakeContact[],
    private limit?: number,
  ) {}

  async beforeEach() {
    let [user1, user2, user3] = await Promise.all([
      createAllContacts({ firstName: "Jon", lastName: "Snow" }),
      createAllContacts({ firstName: "Aegon", lastName: "Targaryen" }),
      createAllContacts({ firstName: "Ned", lastName: "Stark" }),
    ]);
    // modify contacts as needed
    user1[1] = this.ents(user1[1]);
    user2[1] = this.ents(user2[1]);
    user3[1] = this.ents(user3[1]);
    this.dataz = [user1, user2, user3];
    QueryRecorder.clearQueries();
  }

  getQuery(viewer?: Viewer) {
    return this.filter(
      UserToContactsQuery.query(
        viewer || new LoggedOutViewer(),
        this.dataz.map((data) => data[0]),
      ),
    );
  }

  async testIDs() {
    const idsMap = await this.getQuery().queryIDs();

    expect(idsMap.size).toBe(this.dataz.length);

    for (let i = 0; i < this.dataz.length; i++) {
      let data = this.dataz[i];

      expect(idsMap.get(data[0].id)).toStrictEqual(
        data[1].map((contact) => contact.id),
      );
    }
    verifyQuery({
      length: this.dataz.length,
      numQueries: this.dataz.length,
      limit: this.limit || DefaultLimit,
    });
  }

  // rawCount isn't affected by filters...
  async testRawCount() {
    const countMap = await this.getQuery().queryRawCount();

    expect(countMap.size).toBe(this.dataz.length);

    for (let i = 0; i < this.dataz.length; i++) {
      let data = this.dataz[i];

      expect(countMap.get(data[0].id)).toStrictEqual(inputs.length);
    }
    verifyCountQuery({ numQueries: 3, length: 3 });
  }

  async testCount() {
    const countMap = await this.getQuery().queryCount();

    expect(countMap.size).toBe(this.dataz.length);

    for (let i = 0; i < this.dataz.length; i++) {
      let data = this.dataz[i];

      expect(countMap.get(data[0].id)).toStrictEqual(data[1].length);
    }
    verifyQuery({
      length: this.dataz.length,
      numQueries: this.dataz.length,
      limit: this.limit || DefaultLimit,
    });
  }

  async testEdges() {
    const edgesMap = await this.getQuery().queryEdges();

    expect(edgesMap.size).toBe(this.dataz.length);

    for (let i = 0; i < this.dataz.length; i++) {
      let data = this.dataz[i];

      verifyUserToContactEdges(data[0], edgesMap, data[1]);
    }
    verifyQuery({
      length: this.dataz.length,
      numQueries: this.dataz.length,
      limit: this.limit || DefaultLimit,
    });
  }

  async testEnts() {
    // privacy...
    const entsMap = await this.getQuery().queryEnts();
    expect(entsMap.size).toBe(this.dataz.length);
    for (let i = 0; i < this.dataz.length; i++) {
      let data = this.dataz[i];
      verifyUserToContacts(data[0], entsMap, []);
    }

    // privacy. only data for the first id is visible in this case
    const entsMap2 = await this.getQuery(
      new IDViewer(this.dataz[0][0].id),
    ).queryEnts();
    expect(entsMap2.size).toBe(this.dataz.length);
    for (let i = 0; i < this.dataz.length; i++) {
      let data = this.dataz[i];
      verifyUserToContacts(data[0], entsMap2, i == 0 ? data[1] : []);
    }
    verifyQuery({
      // extra query for the nodes
      // dataz.length twice to fetch the edge data
      // and then twice to fetch all the nodes for the contacts
      length: this.dataz.length + this.dataz.length + this.dataz.length * 2,
      numQueries: this.dataz.length,
      limit: this.limit || DefaultLimit,
    });
  }
}

describe("multi-ids", () => {
  const filter = new MultiIDsTestQueryFilter(
    (q: UserToContactsQuery) => {
      // no filters
      return q;
    },
    (contacts: FakeContact[]) => {
      // nothing to do here
      // reverse because edges are most recent first
      return contacts.reverse();
    },
  );

  beforeEach(async () => {
    await filter.beforeEach();
  });

  test("ids", async () => {
    await filter.testIDs();
  });

  test("rawCount", async () => {
    await filter.testRawCount();
  });

  test("count", async () => {
    await filter.testCount();
  });

  test("edges", async () => {
    await filter.testEdges();
  });

  test("ents", async () => {
    await filter.testEnts();
  });
});

describe("multi-ids. firstN", () => {
  const filter = new MultiIDsTestQueryFilter(firstNFilter, firstNEntsFilter, 2);

  beforeEach(async () => {
    await filter.beforeEach();
  });

  test("ids", async () => {
    await filter.testIDs();
  });

  test("rawCount", async () => {
    await filter.testRawCount();
  });

  test("count", async () => {
    await filter.testCount();
  });

  test("edges", async () => {
    await filter.testEdges();
  });

  test("ents", async () => {
    await filter.testEnts();
  });
});

class ChainTestQueryFilter {
  user: FakeUser;
  event: FakeEvent;
  event2: FakeEvent;
  friends: FakeUser[];

  constructor(
    private initialQuery: EdgeQueryCtr<Ent>,
    private subsequentQueries: EdgeQueryCtr<Ent>[],
    private filter: (q: EdgeQuery<Ent>) => EdgeQuery<Ent>,
    private lastHopFilter?: (q: EdgeQuery<Ent>) => EdgeQuery<Ent>,
  ) {}

  async beforeEach() {
    this.user = await createTestUser();
    this.event = await createTestEvent(this.user);
    this.event2 = await createTestEvent(this.user, { title: "Red Wedding" });

    this.friends = await Promise.all(
      inputs.map(async (input) => {
        // just to make times deterministic so that tests can consistently work
        advanceBy(100);
        const builder = getUserBuilder(this.user.viewer, getUserInput(input));
        // add edge from user to contact
        builder.orchestrator.addOutboundEdge(
          this.user.id,
          EdgeType.UserToFriends,
          NodeType.FakeUser,
          {
            time: new Date(), // set time to advanceBy time
          },
        );
        // all invited and all attending
        builder.orchestrator.addInboundEdge(
          this.event.id,
          EdgeType.EventToInvited,
          "Event",
        );
        builder.orchestrator.addInboundEdge(
          this.event.id,
          EdgeType.EventToAttendees,
          NodeType.FakeEvent,
        );
        // Robb also attending the red wedding
        if (input.firstName === "Robb") {
          builder.orchestrator.addInboundEdge(
            this.event2.id,
            EdgeType.EventToInvited,
            NodeType.FakeEvent,
          );
          builder.orchestrator.addInboundEdge(
            this.event2.id,
            EdgeType.EventToAttendees,
            NodeType.FakeEvent,
          );
        }
        return await builder.saveX();
      }),
    );

    expect(this.friends.length).toBe(inputs.length);

    const countMap = await UserToFriendsQuery.query(
      new IDViewer(this.user.id),
      this.user.id,
    ).queryCount();
    expect(countMap.get(this.user.id)).toStrictEqual(inputs.length);
  }

  getQuery(vc: Viewer) {
    return this.filter(new this.initialQuery(vc, this.user.id));
  }

  private async compare(
    fn: (q: EdgeQuery<Ent>) => any,
    comparer?: (oneHop: any, allHops: any) => any,
  ) {
    const vc = new IDViewer(this.user.id);
    const oneHopResult = await fn(this.getQuery(vc));

    const queries = [this.initialQuery, ...this.subsequentQueries];
    let last: ID[] = [this.user.id];
    let allHopsResult: any;
    for (let i = 0; i < queries.length; i++) {
      let queryCtr = queries[i];

      let query = new queryCtr(vc, last);
      if (this.lastHopFilter && i + 1 == queries.length - 1) {
        query = this.lastHopFilter(query);
      }
      if (i === queries.length - 1) {
        allHopsResult = await fn(query);
        break;
      }

      let result = await query.queryIDs();
      // reset last
      last = [];
      for (const [_, ids] of result) {
        last.push(...ids);
      }
    }
    if (comparer) {
      comparer(oneHopResult, allHopsResult);
    } else {
      expect(oneHopResult).toStrictEqual(allHopsResult);
    }
  }

  async testIDs() {
    await this.compare((q) => q.queryIDs());
  }

  async testCount() {
    await this.compare((q) => q.queryCount());
  }

  async testRawCount() {
    await this.compare((q) => q.queryRawCount());
  }

  async testEdges() {
    await this.compare((q) => q.queryEdges());
  }

  async testEnts() {
    function compare(oneHop: Map<ID, Ent[]>, allHops: Map<ID, Ent[]>) {
      expect(allHops.size).toEqual(oneHop.size);
      for (const [key, ents] of allHops) {
        expect(oneHop.has(key)).toEqual(true);

        const oneHopEnts = oneHop.get(key)!;
        for (let i = 0; i < ents.length; i++) {
          expect(oneHopEnts[i].id).toEqual(ents[i].id);
        }
      }
    }
    await this.compare((q) => q.queryEnts(), compare);
  }
}

describe("chained queries 2 steps", () => {
  const filter = new ChainTestQueryFilter(
    UserToFriendsQuery,
    [UserToEventsAttendingQuery],
    (q: UserToFriendsQuery) => {
      return q.queryEventsAttending();
    },
  );

  beforeEach(async () => {
    await filter.beforeEach();
  });

  test("ids", async () => {
    await filter.testIDs();
  });

  test("count", async () => {
    await filter.testCount();
  });

  test("rawCount", async () => {
    await filter.testRawCount();
  });

  test("edges", async () => {
    await filter.testEdges();
  });

  test("ents", async () => {
    await filter.testEnts();
  });
});

describe("chained queries 2 steps w/ filter", () => {
  const filter = new ChainTestQueryFilter(
    UserToFriendsQuery,
    [UserToEventsAttendingQuery],
    (q: UserToFriendsQuery) => {
      return q.first(2).queryEventsAttending();
    },
    (q: UserToFriendsQuery) => {
      return q.first(2);
    },
  );

  beforeEach(async () => {
    await filter.beforeEach();
  });

  test("ids", async () => {
    await filter.testIDs();
  });

  test("count", async () => {
    await filter.testCount();
  });

  test("rawCount", async () => {
    await filter.testRawCount();
  });

  test("edges", async () => {
    await filter.testEdges();
  });

  test("ents", async () => {
    await filter.testEnts();
  });
});

describe("chained queries 3 steps", () => {
  const filter = new ChainTestQueryFilter(
    UserToFriendsQuery,
    [UserToEventsAttendingQuery, EventToHostsQuery],
    (q: UserToFriendsQuery) => {
      return q.queryEventsAttending().queryHosts();
    },
  );

  beforeEach(async () => {
    await filter.beforeEach();
  });

  test("ids", async () => {
    await filter.testIDs();
  });

  test("count", async () => {
    await filter.testCount();
  });

  test("rawCount", async () => {
    await filter.testRawCount();
  });

  test("edges", async () => {
    await filter.testEdges();
  });

  test("ents", async () => {
    await filter.testEnts();
  });
});

// TODO need to figure out a better way to test time. we had ms here
// for times but we needed Date object comparions
// tests work for both but production only works with Date comparisons
// flaw with nosql parse_sql implementation
