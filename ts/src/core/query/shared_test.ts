import { QueryRecorder } from "../../testutils/db_mock";
import { Ent, Data, ID, Viewer } from "../base";
import { DefaultLimit, AssocEdge, getCursor } from "../ent";
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
  verifyUserToContactEdges,
  verifyUserToContacts,
  createEdges,
  setupTempDB,
  tempDBTables,
} from "../../testutils/fake_data/test_helpers";
import { EdgeQuery } from "./query";
import { setupSqlite, TempDB } from "../../testutils/db/test_db";
import { TestContext } from "../../testutils/context/test_context";
import { setLogLevels } from "../logger";

class TestQueryFilter<TData extends Data> {
  private allContacts: FakeContact[] = [];
  private filteredContacts: FakeContact[] = [];
  private user: FakeUser;
  constructor(
    private filter: (
      q: EdgeQuery<FakeUser, FakeContact, TData>,
      user: FakeUser,
      contacts: FakeContact[],
    ) => EdgeQuery<FakeUser, FakeContact, TData>,
    private newQuery: (
      v: Viewer,
      user: FakeUser,
    ) => EdgeQuery<FakeUser, FakeContact, TData>,
    private ents: (contacts: FakeContact[]) => FakeContact[],
    private defaultViewer: Viewer,
  ) {}

  async beforeEach() {
    //    console.log("sss");
    [this.user, this.allContacts] = await createAllContacts();
    //    console.log(this.user, this.contacts);
    //    this.allContacts = this.allContacts.reverse();
    this.filteredContacts = this.ents(this.allContacts);
    QueryRecorder.clearQueries();
  }

  getQuery(viewer?: Viewer) {
    return this.filter(
      this.newQuery(viewer || this.defaultViewer, this.user),
      this.user,
      this.allContacts,
    );
  }

  async testIDs() {
    const ids = await this.getQuery().queryIDs();
    this.verifyIDs(ids);
  }

  private verifyIDs(ids: ID[]) {
    expect(ids).toEqual(this.filteredContacts.map((contact) => contact.id));
  }

  // rawCount isn't affected by filters...
  async testRawCount() {
    const count = await this.getQuery().queryRawCount();
    this.verifyRawCount(count);
  }

  private verifyRawCount(count: number) {
    expect(count).toBe(inputs.length);
  }

  async testCount() {
    const count = await this.getQuery().queryCount();
    this.verifyCount(count);
  }

  private verifyCount(count: number) {
    expect(count).toBe(this.filteredContacts.length);
  }

  async testEdges() {
    const edges = await this.getQuery().queryEdges();
    this.verifyEdges(edges);
  }

  private verifyEdges(edges: Data[]) {
    const q = this.getQuery();

    // TODO sad not generic enough
    if (q instanceof UserToContactsFkeyQuery) {
      verifyUserToContactRawData(this.user, edges, this.filteredContacts);
    } else {
      verifyUserToContactEdges(
        this.user,
        edges as AssocEdge[],
        this.filteredContacts,
      );
    }
  }

  async testEnts() {
    const entsMap = await this.getQuery(new IDViewer(this.user.id)).queryEnts();
    this.verifyEnts(entsMap);
  }

  private verifyEnts(ents: FakeContact[]) {
    verifyUserToContacts(this.user, ents, this.filteredContacts);
  }

  async testAll() {
    const query = this.getQuery(new IDViewer(this.user.id));
    const [edges, count, ids, rawCount, ents] = await Promise.all([
      query.queryEdges(),
      query.queryCount(),
      query.queryIDs(),
      query.queryRawCount(),
      query.queryEnts(),
    ]);
    this.verifyCount(count);
    this.verifyEdges(edges);
    this.verifyIDs(ids);
    this.verifyRawCount(rawCount);
    this.verifyEnts(ents);
  }
}

const preparedVar = /(\$(\d))/g;

interface options<TData extends Data> {
  newQuery: (
    v: Viewer,
    user: FakeUser,
  ) => EdgeQuery<FakeUser, FakeContact, TData>;
  tableName: string;

  entsLength?: number;
  where: string;
  sortCol: string;
  livePostgresDB?: boolean; // if livedb creates temp db and not depending on mock
  sqlite?: boolean; // do this in sqlite
}

export const commonTests = <TData extends Data>(opts: options<TData>) => {
  function verifyQuery({
    length = 1,
    numQueries = 1,
    limit = DefaultLimit,
    disablePaginationBump = false,
  }) {
    if (opts.livePostgresDB || opts.sqlite) {
      return;
    }
    const queries = QueryRecorder.getCurrentQueries();
    expect(queries.length).toBe(length);
    for (let i = 0; i < numQueries; i++) {
      const query = queries[i];
      let expLimit = disablePaginationBump ? limit : limit + 1;
      expect(query.qs?.whereClause, `${i}`).toBe(
        // default limit
        `${opts.where} ORDER BY ${opts.sortCol} DESC LIMIT ${expLimit}`,
      );
    }
  }

  function verifyCountQuery({ length = 1, numQueries = 1 }) {
    if (opts.livePostgresDB || opts.sqlite) {
      return;
    }
    const queries = QueryRecorder.getCurrentQueries();
    expect(queries.length).toBe(length);
    for (let i = 0; i < numQueries; i++) {
      const query = queries[i];
      expect(query.qs?.whereClause).toBe(opts.where);
      expect(query.qs?.columns).toHaveLength(1);
      expect(query.qs?.columns).toStrictEqual(["count(1) as count"]);
    }
  }

  function verifyFirstAfterCursorQuery(length: number = 1) {
    if (opts.livePostgresDB || opts.sqlite) {
      return;
    }
    const queries = QueryRecorder.getCurrentQueries();
    expect(queries.length).toBe(length);
    const query = queries[0];
    const result = [...opts.where.matchAll(preparedVar)];

    expect(query.qs?.whereClause).toBe(
      `${opts.where} AND ${opts.sortCol} < $${result.length + 1} ORDER BY ${
        opts.sortCol
      } DESC LIMIT 4`,
    );
  }

  function verifyLastBeforeCursorQuery(length: number = 1) {
    if (opts.livePostgresDB || opts.sqlite) {
      return;
    }
    const queries = QueryRecorder.getCurrentQueries();
    expect(queries.length).toBe(length);
    const query = queries[0];
    const result = [...opts.where.matchAll(preparedVar)];

    expect(query.qs?.whereClause).toBe(
      // extra fetched for pagination
      `${opts.where} AND ${opts.sortCol} > $${result.length + 1} ORDER BY ${
        opts.sortCol
      } ASC LIMIT 4`,
    );
  }

  function getViewer() {
    // live db, let's do context because we're testing complicated paths
    // may be worth breaking this out later

    // opts.liveDB no context too...
    // maybe this one we just always hit the db
    // we don't get value out of testing parse_sql no context....
    if (opts.livePostgresDB || opts.sqlite) {
      return new TestContext().getViewer();
    }
    // no context when not live db
    return new LoggedOutViewer();
  }

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

  let tdb: TempDB;
  if (opts.sqlite) {
    // tableName just to make it unique
    setupSqlite(`sqlite:///shared_test+${opts.tableName}.db`, tempDBTables);
  }

  beforeAll(async () => {
    // want error on by default in tests?
    setLogLevels(["error", "warn", "info"]);
    if (opts.livePostgresDB) {
      tdb = await setupTempDB();
    }
  });

  beforeEach(async () => {
    if (opts.livePostgresDB) {
      return;
    }
    await createEdges();
  });

  afterAll(async () => {
    if (opts.livePostgresDB && tdb) {
      await tdb.afterAll();
    }
  });

  describe("simple queries", () => {
    const filter = new TestQueryFilter(
      (q: EdgeQuery<FakeUser, FakeContact, TData>) => {
        // no filterzs
        return q;
      },
      opts.newQuery,
      (contacts: FakeContact[]) => {
        // nothing to do here
        // reverse because edges are most recent first
        return contacts.reverse();
      },
      getViewer(),
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
      verifyQuery({ length: opts.entsLength });
    });

    test("all", async () => {
      await filter.testAll();
    });
  });

  describe("first. no cursor", () => {
    const N = 2;
    const filter = new TestQueryFilter(
      (q: EdgeQuery<FakeUser, FakeContact, TData>) => {
        // no filters
        return q.first(N);
      },
      opts.newQuery,

      (contacts: FakeContact[]) => {
        return contacts.reverse().slice(0, N);
      },
      getViewer(),
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
      verifyQuery({ limit: 2, length: opts.entsLength });
    });

    test("all", async () => {
      await filter.testAll();
    });
  });

  describe("last", () => {
    const N = 2;

    const filter = new TestQueryFilter(
      (q: EdgeQuery<FakeUser, FakeContact, TData>) => {
        // no filters
        return q.last(N);
      },
      opts.newQuery,
      (contacts: FakeContact[]) => {
        // take the first N and then reverse it to get the last N in the right order
        return contacts.slice(0, N).reverse();
      },
      getViewer(),
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
      verifyQuery({ disablePaginationBump: true, length: opts.entsLength });
    });

    test("all", async () => {
      await filter.testAll();
    });
  });

  describe("first after cursor", () => {
    const idx = 2;
    const N = 3;
    const filter = new TestQueryFilter(
      (
        q: EdgeQuery<FakeUser, FakeContact, TData>,
        user: FakeUser,
        contacts: FakeContact[],
      ) => {
        return q.first(N, getCursorFrom(contacts, idx));
      },
      opts.newQuery,
      (contacts: FakeContact[]) => {
        // < check so we shouldn't get that index
        return contacts.reverse().slice(idx + 1, idx + N);
      },
      getViewer(),
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
      verifyFirstAfterCursorQuery(opts.entsLength);
    });

    test("all", async () => {
      await filter.testAll();
    });
  });

  test("first. after each cursor", async () => {
    let [user, contacts] = await createAllContacts();
    contacts = contacts.reverse();
    const edges = await opts.newQuery(getViewer(), user).queryEdges();

    let query: EdgeQuery<FakeUser, FakeContact, Data>;

    async function verify(
      i: number,
      hasEdge: boolean,
      hasNextPage: boolean,
      cursor?: string,
    ) {
      query = opts.newQuery(getViewer(), user);
      const newEdges = await query.first(1, cursor).queryEdges();

      const pagination = query.paginationInfo().get(user.id);
      if (hasEdge) {
        expect(newEdges.length, `${i}`).toBe(1);
        expect(newEdges[0], `${i}`).toStrictEqual(edges[i]);
      } else {
        expect(newEdges.length, `${i}`).toBe(0);
      }

      if (hasNextPage) {
        expect(pagination?.hasNextPage).toBe(true);
        expect(pagination?.hasPreviousPage).toBe(false);
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
    const filter = new TestQueryFilter(
      (
        q: EdgeQuery<FakeUser, FakeContact, TData>,
        user: FakeUser,
        contacts: FakeContact[],
      ) => {
        return q.last(N, getCursorFrom(contacts, idx));
      },
      opts.newQuery,
      (contacts: FakeContact[]) => {
        // > check so we don't want that index
        return contacts.reverse().slice(0, idx).reverse(); // because of order returned
      },
      getViewer(),
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
      verifyLastBeforeCursorQuery(opts.entsLength);
    });

    test("all", async () => {
      await filter.testAll();
    });
  });

  test("last. before each cursor", async () => {
    let [user, contacts] = await createAllContacts();
    contacts = contacts.reverse();
    const edges = await opts.newQuery(getViewer(), user).queryEdges();

    let query: EdgeQuery<FakeUser, FakeContact, Data>;
    async function verify(
      i: number,
      hasEdge: boolean,
      hasPreviousPage: boolean,
      cursor?: string,
    ) {
      query = opts.newQuery(getViewer(), user);
      const newEdges = await query.last(1, cursor).queryEdges();

      const pagination = query.paginationInfo().get(user.id);
      if (hasEdge) {
        expect(newEdges.length, `${i}`).toBe(1);
        expect(newEdges[0], `${i}`).toStrictEqual(edges[i]);
      } else {
        expect(newEdges.length, `${i}`).toBe(0);
      }

      if (hasPreviousPage) {
        expect(pagination?.hasPreviousPage).toBe(true);
        expect(pagination?.hasNextPage).toBe(false);
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
};

// TODO parse_sql group by...
// or test it with real db...
