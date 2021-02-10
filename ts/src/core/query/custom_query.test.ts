import { Pool } from "pg";
import { QueryRecorder } from "../../testutils/db_mock";
import { Data, ID, Viewer, DefaultLimit } from "../ent";
import { IDViewer, LoggedOutViewer } from "../viewer";
import {
  FakeUser,
  FakeContact,
  UserToContactsFkeyQuery,
} from "../../testutils/fake_data/index";
import {
  inputs,
  createAllContacts,
  verifyUserToContactRawData,
  verifyUserToContacts,
  createEdges,
} from "../../testutils/fake_data/test_helpers";

jest.mock("pg");
QueryRecorder.mockPool(Pool);

beforeEach(async () => {
  QueryRecorder.clear();
  // TODO figure out why this failed in the absence of this and have it fail loudly...
  await createEdges();
  QueryRecorder.clearQueries();
});

class TestQueryFilter {
  private contacts: FakeContact[] = [];
  private user: FakeUser;
  constructor(
    private filter: (
      q: UserToContactsFkeyQuery,
      user: FakeUser,
    ) => UserToContactsFkeyQuery,
    private ents: (contacts: FakeContact[]) => FakeContact[],
  ) {}

  async beforeEach() {
    //    console.log("sss");
    [this.user, this.contacts] = await createAllContacts({}, true);
    //    console.log(this.user, this.contacts);
    this.contacts = this.ents(this.contacts);
    QueryRecorder.clearQueries();
  }

  getQuery(viewer?: Viewer) {
    return this.filter(
      UserToContactsFkeyQuery.query(viewer || new LoggedOutViewer(), this.user),
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

  private verifyEdges(edgesMap: Map<ID, Data[]>) {
    expect(edgesMap.size).toBe(1);

    verifyUserToContactRawData(this.user, edgesMap, this.contacts);
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
      idsMap,
      rawCountMap,
      entsMap,
    ] = await Promise.all([
      query.queryEdges(),
      query.queryCount(),
      query.queryIDs(),
      query.queryRawCount(),
      query.queryEnts(),
    ]);
    this.verifyCount(countMap);
    this.verifyEdges(edgesMap);
    this.verifyIDs(idsMap);
    this.verifyRawCount(rawCountMap);
    this.verifyEnts(entsMap as Map<ID, FakeContact[]>); // TS bug?
  }
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
      `user_id = $1 ORDER BY created_at DESC LIMIT ${expLimit}`,
    );
  }
}

function verifyCountQuery({ length = 1, numQueries = 1 }) {
  const queries = QueryRecorder.getCurrentQueries();
  expect(queries.length).toBe(length);
  for (let i = 0; i < numQueries; i++) {
    const query = queries[i];
    expect(query.qs?.whereClause).toBe(`user_id = $1`);
    expect(query.qs?.columns).toHaveLength(1);
    expect(query.qs?.columns).toStrictEqual(["count(*) as count"]);
  }
}

function verifyFirstAfterCursorQuery(length: number = 1) {
  const queries = QueryRecorder.getCurrentQueries();
  expect(queries.length).toBe(length);
  const query = queries[0];
  expect(query.qs?.whereClause).toBe(
    `user_id = $1 AND created_at < $2 ORDER BY created_at DESC LIMIT 4`,
  );
}

function verifyLastBeforeCursorQuery(length: number = 1) {
  const queries = QueryRecorder.getCurrentQueries();
  expect(queries.length).toBe(length);
  const query = queries[0];
  expect(query.qs?.whereClause).toBe(
    // extra fetched for pagination
    `user_id = $1 AND created_at > $2 ORDER BY created_at ASC LIMIT 4`,
  );
}

describe("simple queries", () => {
  const filter = new TestQueryFilter(
    (q: UserToContactsFkeyQuery) => {
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
    verifyQuery({});
  });

  test("all", async () => {
    await filter.testAll();
  });
});

describe("first. no cursor", () => {
  const N = 2;
  const filter = new TestQueryFilter(
    (q: UserToContactsFkeyQuery) => {
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
    verifyQuery({ limit: 2 });
  });

  test("all", async () => {
    await filter.testAll();
  });
});

describe("last", () => {
  const N = 2;
  const filter = new TestQueryFilter(
    (q: UserToContactsFkeyQuery) => {
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
    verifyQuery({ disablePaginationBump: true });
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
    (q: UserToContactsFkeyQuery, user: FakeUser) => {
      rows = QueryRecorder.filterData("fake_contacts", (row) => {
        return row.user_id === user.id;
      }).reverse(); // need to reverse
      const cursor = q.getCursor(rows[idx]);

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
    verifyFirstAfterCursorQuery();
  });

  test("all", async () => {
    await filter.testAll();
  });
});

test("first. after each cursor", async () => {
  let [user, contacts] = await createAllContacts();
  contacts = contacts.reverse();
  const edgesMap = await UserToContactsFkeyQuery.query(
    new LoggedOutViewer(),
    user.id,
  ).queryEdges();
  const edges = edgesMap.get(user.id) || [];

  let query: UserToContactsFkeyQuery;

  async function verify(
    i: number,
    hasEdge: boolean,
    hasNextPage: boolean,
    cursor?: string,
  ) {
    query = UserToContactsFkeyQuery.query(new LoggedOutViewer(), user.id);
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
  await verify(1, true, true, query!.getCursor(edges[0]));
  await verify(2, true, true, query!.getCursor(edges[1]));
  await verify(3, true, true, query!.getCursor(edges[2]));
  await verify(4, true, false, query!.getCursor(edges[3]));
  await verify(5, false, false, query!.getCursor(edges[4]));
});

describe("last. before cursor", () => {
  const idx = 2;
  const N = 3;
  let rows: Data[] = [];
  const filter = new TestQueryFilter(
    (q: UserToContactsFkeyQuery, user: FakeUser) => {
      rows = QueryRecorder.filterData("fake_contacts", (row) => {
        return row.user_id === user.id;
      }).reverse(); // need to reverse
      const cursor = q.getCursor(rows[idx]);

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
    verifyLastBeforeCursorQuery();
  });

  test("all", async () => {
    await filter.testAll();
  });
});

test("last. before each cursor", async () => {
  let [user, contacts] = await createAllContacts();
  contacts = contacts.reverse();
  const edgesMap = await UserToContactsFkeyQuery.query(
    new LoggedOutViewer(),
    user.id,
  ).queryEdges();
  const edges = edgesMap.get(user.id) || [];

  let query: UserToContactsFkeyQuery;
  async function verify(
    i: number,
    hasEdge: boolean,
    hasPreviousPage: boolean,
    cursor?: string,
  ) {
    query = UserToContactsFkeyQuery.query(new LoggedOutViewer(), user.id);
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
  await verify(3, true, true, query!.getCursor(edges[4]));
  await verify(2, true, true, query!.getCursor(edges[3]));
  await verify(1, true, true, query!.getCursor(edges[2]));
  await verify(0, true, false, query!.getCursor(edges[1]));
  await verify(-1, false, false, query!.getCursor(edges[0]));
});
