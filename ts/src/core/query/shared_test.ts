import { Data, ID, Viewer } from "../base";
import { DefaultLimit, AssocEdge, getCursor, setGlobalSchema } from "../ent";
import { IDViewer, LoggedOutViewer } from "../viewer";
import {
  FakeUser,
  FakeContact,
  UserToContactsFkeyQueryDeprecated,
  FakeUserSchema,
  EdgeType,
  FakeContactSchema,
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
import { setupSqlite, TempDB } from "../../testutils/db/temp_db";
import { TestContext } from "../../testutils/context/test_context";
import { setLogLevels } from "../logger";
import { testEdgeGlobalSchema } from "../../testutils/test_edge_global_schema";
import { SimpleAction } from "../../testutils/builder";
import { WriteOperation } from "../../action";
import { MockLogs } from "../../testutils/mock_log";
import { Clause, Greater, Less } from "../clause";

interface options<TData extends Data> {
  newQuery: (
    v: Viewer,
    user: FakeUser,
  ) => EdgeQuery<FakeUser, FakeContact, TData>;
  tableName: string;
  uniqKey: string;
  ml: MockLogs;

  entsLength?: number;
  clause: Clause;
  sortCol: string;
  livePostgresDB?: boolean; // if livedb creates temp db and not depending on mock
  sqlite?: boolean; // do this in sqlite
  globalSchema?: boolean;
  rawDataVerify?(user: FakeUser): Promise<void>;
}

function getWhereClause(query: any) {
  let execArray = /^SELECT (.+) FROM (.+) WHERE (.+)?/.exec(query.query);
  return execArray?.[3];
}

export const commonTests = <TData extends Data>(opts: options<TData>) => {
  setLogLevels("query");
  const ml = opts.ml;
  ml.mock();

  class TestQueryFilter<TData extends Data> {
    allContacts: FakeContact[] = [];
    private filteredContacts: FakeContact[] = [];
    user: FakeUser;
    customQuery: boolean;
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
    ) {
      // @ts-ignore
      const q = this.newQuery(this.defaultViewer);

      // TODO sad not generic enough
      this.customQuery =
        q instanceof UserToContactsFkeyQuery ||
        q instanceof UserToContactsFkeyQueryDeprecated;
    }

    async createData() {
      [this.user, this.allContacts] = await createAllContacts();
      //    this.allContacts = this.allContacts.reverse();
      this.filteredContacts = this.ents(this.allContacts);
      ml.clear();
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
    async testRawCount(expectedCount?: number) {
      const count = await this.getQuery().queryRawCount();
      this.verifyRawCount(count, expectedCount);
    }

    private verifyRawCount(count: number, expectedCount?: number) {
      expect(count).toBe(expectedCount ?? inputs.length);
    }

    async testCount(expectedCount?: number) {
      const count = await this.getQuery().queryCount();
      this.verifyCount(count, expectedCount);
    }

    private verifyCount(count: number, expectedCount?: number) {
      expect(count).toBe(expectedCount ?? this.filteredContacts.length);
    }

    async testEdges() {
      const edges = await this.getQuery().queryEdges();
      this.verifyEdges(edges);
    }

    private verifyEdges(edges: Data[]) {
      const q = this.getQuery();

      // TODO sad not generic enough
      if (this.customQuery) {
        verifyUserToContactRawData(this.user, edges, this.filteredContacts);
      } else {
        verifyUserToContactEdges(
          this.user,
          edges as AssocEdge[],
          this.filteredContacts,
        );
      }
    }

    async testEnts(v?: Viewer) {
      const ents = await this.getQuery(
        v || new IDViewer(this.user.id),
      ).queryEnts();
      this.verifyEnts(ents);
      return ents;
    }

    async testEntsCache() {
      if (!this.customQuery) {
        return;
      }
      setLogLevels(["query", "cache"]);
      const v = new TestContext(new IDViewer(this.user.id)).getViewer();
      const ents = await this.testEnts(v);
      expect(ml.logs.length).toBe(1);
      expect(ml.logs[0].query).toMatch(/SELECT (.+) FROM /);

      await Promise.all(ents.map((ent) => FakeContact.loadX(v, ent.id)));

      expect(ml.logs.length).toBe(this.filteredContacts.length + 1);
      for (const log of ml.logs.slice(1)) {
        expect(log["ent-cache-hit"]).toBeDefined();
      }
      // "restore" back to previous
      setLogLevels("query");
    }

    async testDataCache() {
      if (!this.customQuery) {
        return;
      }
      setLogLevels(["query", "cache"]);
      const v = new TestContext(new IDViewer(this.user.id)).getViewer();
      const ents = await this.testEnts(v);
      expect(ml.logs.length).toBe(1);
      expect(ml.logs[0].query).toMatch(/SELECT (.+) FROM /);

      await Promise.all(
        ents.map((ent) => FakeContact.loadRawData(ent.id, v.context)),
      );

      expect(ml.logs.length).toBe(this.filteredContacts.length + 1);
      for (const log of ml.logs.slice(1)) {
        expect(log["dataloader-cache-hit"]).toBeDefined();
      }
      // "restore" back to previous
      setLogLevels("query");
    }

    private verifyEnts(ents: FakeContact[]) {
      verifyUserToContacts(this.user, ents, this.filteredContacts);
    }

    async testAll(expectedCount?: number) {
      const query = this.getQuery(new IDViewer(this.user.id));
      const [edges, count, ids, rawCount, ents] = await Promise.all([
        query.queryEdges(),
        query.queryCount(),
        query.queryIDs(),
        query.queryRawCount(),
        query.queryEnts(),
      ]);
      this.verifyCount(count, expectedCount);
      this.verifyEdges(edges);
      this.verifyIDs(ids);
      this.verifyRawCount(rawCount, expectedCount);
      this.verifyEnts(ents);
    }
  }

  function verifyQuery({
    length = 1,
    numQueries = 1,
    limit = DefaultLimit,
    disablePaginationBump = false,
  }) {
    expect(ml.logs.length).toBe(length);
    for (let i = 0; i < numQueries; i++) {
      const whereClause = getWhereClause(ml.logs[i]);
      let expLimit = disablePaginationBump ? limit : limit + 1;
      expect(whereClause, `${i}`).toBe(
        // default limit
        `${opts.clause.clause(1)} ORDER BY ${
          opts.sortCol
        } DESC LIMIT ${expLimit}`,
      );
    }
  }

  function verifyCountQuery({ length = 1, numQueries = 1 }) {
    expect(ml.logs.length).toBe(length);
    for (let i = 0; i < numQueries; i++) {
      const whereClause = getWhereClause(ml.logs[i]);
      expect(whereClause).toBe(opts.clause.clause(1));
    }
  }

  function verifyFirstAfterCursorQuery(length: number = 1) {
    // cache showing up in a few because of cross runs...
    expect(ml.logs.length).toBeGreaterThanOrEqual(length);

    let parts = opts.clause.clause(1).split(" AND ");
    const less = Less(opts.sortCol, "").clause(opts.clause.values().length + 1);
    if (parts[parts.length - 1] === "deleted_at IS NULL") {
      parts = parts
        .slice(0, parts.length - 1)
        .concat([less, "deleted_at IS NULL"]);
    } else {
      parts.push(less);
    }

    expect(getWhereClause(ml.logs[0])).toBe(
      `${parts.join(" AND ")} ORDER BY ${opts.sortCol} DESC LIMIT 4`,
    );
  }

  function verifyLastBeforeCursorQuery(length: number = 1) {
    // cache showing up in a few because of cross runs...
    expect(ml.logs.length).toBeGreaterThanOrEqual(length);

    let parts = opts.clause.clause(1).split(" AND ");
    const greater = Greater(opts.sortCol, "").clause(
      opts.clause.values().length + 1,
    );
    if (parts[parts.length - 1] === "deleted_at IS NULL") {
      parts = parts
        .slice(0, parts.length - 1)
        .concat([greater, "deleted_at IS NULL"]);
    } else {
      parts.push(greater);
    }

    expect(getWhereClause(ml.logs[0])).toBe(
      // extra fetched for pagination
      `${parts.join(" AND ")} ORDER BY ${opts.sortCol} ASC LIMIT 4`,
    );
  }

  function getViewer() {
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

  if (opts.globalSchema) {
    setGlobalSchema(testEdgeGlobalSchema);
  }

  let tdb: TempDB;
  if (opts.sqlite) {
    setupSqlite(
      `sqlite:///shared_test+${opts.uniqKey}.db`,
      () => tempDBTables(opts.globalSchema),
      {
        disableDeleteAfterEachTest: true,
      },
    );
  }

  beforeAll(async () => {
    // want error on by default in tests?
    setLogLevels(["error", "warn", "info"]);
    if (opts.livePostgresDB) {
      tdb = await setupTempDB(opts.globalSchema);
      return;
    }
    await createEdges();
  });

  afterAll(async () => {
    if (opts.livePostgresDB && tdb) {
      await tdb.afterAll();
    }
  });

  // convert just these...
  // and then have a special test for conflicts.....
  // or change API to have conflicts...
  describe.only("simple queries", () => {
    const filter = new TestQueryFilter(
      (q: EdgeQuery<FakeUser, FakeContact, TData>) => {
        // no filters
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
      await filter.createData();
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

    test("ents cache", async () => {
      await filter.testEntsCache();
    });

    test("data cache", async () => {
      await filter.testDataCache();
    });
  });

  describe("after delete", () => {
    const filter = new TestQueryFilter(
      (q: EdgeQuery<FakeUser, FakeContact, TData>) => {
        // no filters
        return q;
      },
      opts.newQuery,
      (contacts: FakeContact[]) => {
        // nothing expected since deleted
        return [];
      },
      getViewer(),
    );

    beforeEach(async () => {
      await filter.createData();
      const action = new SimpleAction(
        filter.user.viewer,
        FakeUserSchema,
        new Map(),
        WriteOperation.Edit,
        filter.user,
      );
      await Promise.all(
        filter.allContacts.map(async (contact) => {
          action.builder.orchestrator.removeOutboundEdge(
            contact.id,
            EdgeType.UserToContacts,
          );

          const action2 = new SimpleAction(
            filter.user.viewer,
            FakeContactSchema,
            new Map(),
            WriteOperation.Delete,
            contact,
          );
          await action2.save();
        }),
      );
      await action.save();
      ml.clear();
    });

    test("ids", async () => {
      await filter.testIDs();
      verifyQuery({});
    });

    test("rawCount", async () => {
      await filter.testRawCount(0);
      verifyCountQuery({});
    });

    test("count", async () => {
      await filter.testCount(0);
      verifyQuery({});
    });

    test("edges", async () => {
      await filter.testEdges();
      verifyQuery({});
    });

    test("ents", async () => {
      await filter.testEnts();
      // no ents so no subsequent query. just the edge query
      verifyQuery({ length: 1 });
    });

    test("all", async () => {
      await filter.testAll(0);
    });

    test("raw_data", async () => {
      if (opts.rawDataVerify) {
        await opts.rawDataVerify(filter.user);
      }
    });

    test("ents cache", async () => {
      await filter.testEntsCache();
    });

    test("data cache", async () => {
      await filter.testDataCache();
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
      await filter.createData();
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

    test("ents cache", async () => {
      await filter.testEntsCache();
    });

    test("data cache", async () => {
      await filter.testDataCache();
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
      await filter.createData();
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

    test("ents cache", async () => {
      await filter.testEntsCache();
    });

    test("data cache", async () => {
      await filter.testDataCache();
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

    beforeAll(async () => {
      await filter.createData();
    });

    beforeEach(() => {
      ml.clear();
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

    test("ents cache", async () => {
      await filter.testEntsCache();
    });

    test("data cache", async () => {
      await filter.testDataCache();
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

    beforeAll(async () => {
      if (opts.livePostgresDB || opts.sqlite) {
        await filter.createData();
      }
    });

    beforeEach(async () => {
      ml.clear();
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

    test("ents cache", async () => {
      await filter.testEntsCache();
    });

    test("data cache", async () => {
      await filter.testDataCache();
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
