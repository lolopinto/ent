import { WriteOperation } from "../../action";
import { BuilderSchema, SimpleAction } from "../../testutils/builder";
import { TestContext } from "../../testutils/context/test_context";
import { setupSqlite, TempDB } from "../../testutils/db/temp_db";
import {
  EdgeType,
  FakeContact,
  FakeContactSchema,
  FakeUser,
  FakeUserSchema,
  UserToContactsFkeyQuery,
  UserToContactsFkeyQueryAsc,
  UserToContactsFkeyQueryDeletedAt,
  UserToContactsFkeyQueryDeletedAtAsc,
  UserToContactsFkeyQueryDeprecated,
} from "../../testutils/fake_data/index";
import {
  createAllContacts,
  createEdges,
  inputs,
  setupTempDB,
  tempDBTables,
  verifyUserToContactEdges,
  verifyUserToContactRawData,
  verifyUserToContacts,
} from "../../testutils/fake_data/test_helpers";
import { MockLogs } from "../../testutils/mock_log";
import {
  getVerifyAfterEachCursorGeneric,
  getWhereClause,
} from "../../testutils/query";
import { testEdgeGlobalSchema } from "../../testutils/test_edge_global_schema";
import { Data, ID, Viewer } from "../base";
import { Clause, PaginationUnboundColsQuery } from "../clause";
import {
  AssocEdge,
  cursorOptions,
  getCursor,
  getDefaultLimit,
  setDefaultLimit,
} from "../ent";
import { setGlobalSchema } from "../global_schema";
import { setLogLevels } from "../logger";
import { getOrderByPhrase, OrderBy, reverseOrderBy } from "../query_impl";
import { IDViewer, LoggedOutViewer } from "../viewer";
import { EdgeQuery } from "./query";

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
  livePostgresDB?: boolean; // if livedb creates temp db and not depending on mock
  sqlite?: boolean; // do this in sqlite
  globalSchema?: boolean;
  orderby: OrderBy;
  rawDataVerify?(user: FakeUser): Promise<void>;
  loadEnt?(v: Viewer, id: ID): Promise<FakeContact>;
  loadRawData?(id: ID, context: any): Promise<Data | null>;
  contactSchemaForDeletionTest?: BuilderSchema<FakeContact>;
}

export const commonTests = <TData extends Data>(opts: options<TData>) => {
  setLogLevels(["query", "error"]);
  const ml = opts.ml;
  ml.mock();

  function isCustomQuery(
    q: TestQueryFilter<any> | EdgeQuery<FakeUser, FakeContact, any>,
  ): boolean {
    if ((q as TestQueryFilter<any>).customQuery !== undefined) {
      return (q as TestQueryFilter<any>).customQuery;
    }

    // TODO sad not generic enough
    return (
      q instanceof UserToContactsFkeyQuery ||
      q instanceof UserToContactsFkeyQueryDeprecated ||
      q instanceof UserToContactsFkeyQueryAsc ||
      q instanceof UserToContactsFkeyQueryDeletedAt ||
      q instanceof UserToContactsFkeyQueryDeletedAtAsc
    );
  }

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
      const q: EdgeQuery<FakeUser, FakeContact, TData> = this.newQuery(
        this.defaultViewer,
      );

      this.customQuery = isCustomQuery(q);
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

      await Promise.all(
        ents.map((ent) =>
          opts.loadEnt ? opts.loadEnt(v, ent.id) : FakeContact.loadX(v, ent.id),
        ),
      );

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
        ents.map((ent) =>
          opts.loadRawData
            ? opts.loadRawData(ent.id, v.context)
            : FakeContact.loadRawData(ent.id, v.context),
        ),
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

  function verifyQuery(
    filter: TestQueryFilter<any> | EdgeQuery<FakeUser, FakeContact, Data>,
    {
      length = 1,
      numQueries = 1,
      limit = getDefaultLimit(),
      disablePaginationBump = false,
      orderby = opts.orderby,
    },
  ) {
    const uniqCol = isCustomQuery(filter) ? "id" : "id2";

    expect(ml.logs.length).toBe(length);
    for (let i = 0; i < numQueries; i++) {
      const whereClause = getWhereClause(ml.logs[i]);
      let expLimit = disablePaginationBump ? limit : limit + 1;
      expect(whereClause, `${i}`).toBe(
        // default limit
        `${opts.clause.clause(1)} ORDER BY ${getOrderByPhrase(
          orderby,
        )} LIMIT ${expLimit}`,
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

  function verifyFirstAfterCursorQuery(
    filter: TestQueryFilter<any> | EdgeQuery<FakeUser, FakeContact, Data>,
    length: number = 1,
    limit: number = 3,
  ) {
    // cache showing up in a few because of cross runs...
    expect(ml.logs.length).toBeGreaterThanOrEqual(length);

    let parts = opts.clause.clause(1).split(" AND ");
    const cmp = PaginationUnboundColsQuery(
      opts.orderby.map((orderBy) => ({
        direction: orderBy.direction,
        sortCol: orderBy.column,
        sortValue: "_",
      })),
    )!.clause(opts.clause.values().length + 1);

    // order of parts is different in custom query seemingly
    const customQuery = isCustomQuery(filter);
    if (!customQuery && parts[parts.length - 1] === "deleted_at IS NULL") {
      parts = parts
        .slice(0, parts.length - 1)
        .concat([`(${cmp})`, "deleted_at IS NULL"]);
    } else {
      parts.push(`(${cmp})`);
    }
    expect(getWhereClause(ml.logs[0])).toBe(
      `${parts.join(" AND ")} ORDER BY ${getOrderByPhrase(
        opts.orderby,
      )} LIMIT ${limit + 1}`,
    );
  }

  function verifyLastBeforeCursorQuery(
    filter: TestQueryFilter<any> | EdgeQuery<FakeUser, FakeContact, Data>,
    { length = 1, limit = 3, orderby = opts.orderby },
  ) {
    // cache showing up in a few because of cross runs...
    expect(ml.logs.length).toBeGreaterThanOrEqual(length);

    let parts = opts.clause.clause(1).split(" AND ");
    const cmp = PaginationUnboundColsQuery(
      opts.orderby.map((orderBy) => ({
        // Reverse order for "last" cursor
        direction: orderBy.direction === "DESC" ? "ASC" : "DESC",
        sortCol: orderBy.column,
        sortValue: "_",
      })),
    )!.clause(opts.clause.values().length + 1);

    // order of parts is different in custom query seemingly
    const customQuery = isCustomQuery(filter);
    if (!customQuery && parts[parts.length - 1] === "deleted_at IS NULL") {
      parts = parts
        .slice(0, parts.length - 1)
        .concat([`(${cmp})`, "deleted_at IS NULL"]);
    } else {
      parts.push(`(${cmp})`);
    }

    expect(getWhereClause(ml.logs[0])).toBe(
      // extra fetched for pagination
      `${parts.join(" AND ")} ORDER BY ${getOrderByPhrase(
        orderby,
      )} LIMIT ${limit + 1}`,
    );
  }

  function getViewer() {
    return new LoggedOutViewer();
  }

  function getCursorFrom(
    q: TestQueryFilter<any> | EdgeQuery<FakeUser, FakeContact, any>,
    contacts: FakeContact[],
    idx: number,
  ) {
    let opts: cursorOptions;
    if (isCustomQuery(q)) {
      opts = {
        row: contacts[idx],
        cursorKeys: ["created_at", "id"],
        rowKeys: ["createdAt", "id"],
      };
    } else {
      // for assoc queries, we're getting the value from 'id' field but the edge
      // is from assoc_edge table id2 field and so cursor takes it from there
      opts = {
        row: contacts[idx],
        cursorKeys: ["time", "id2"],
        rowKeys: ["createdAt", "id"],
      };
    }
    return getCursor(opts);
  }

  function getVerifyAfterEachCursor<TData extends Data>(
    edges: TData[],
    pageLength: number,
    user: FakeUser,
  ) {
    return getVerifyAfterEachCursorGeneric<FakeUser, FakeContact, TData>(
      edges,
      pageLength,
      user,
      // @ts-ignore weirdness with import paths...
      () => opts.newQuery(getViewer(), user),
      ml,
      (query, cursor) => {
        if (cursor) {
          verifyFirstAfterCursorQuery(query, 1, pageLength);
        } else {
          verifyQuery(query, { orderby: opts.orderby, limit: pageLength });
        }
      },
    );
  }

  function getVerifyBeforeEachCursor(
    edges: TData[],
    pageLength: number,
    user: FakeUser,
  ) {
    let query: EdgeQuery<FakeUser, FakeContact, Data>;

    async function verify(
      i: number,
      hasEdge: boolean,
      hasPreviousPage: boolean,
      cursor?: string,
    ) {
      ml.clear();

      query = opts.newQuery(getViewer(), user);
      const newEdges = await query.last(pageLength, cursor).queryEdges();

      const pagination = query.paginationInfo().get(user.id);
      if (hasEdge) {
        expect(newEdges.length, `${i}`).toBe(
          i >= pageLength ? pageLength : i + 1,
        );
        expect(newEdges[0], `${i}`).toStrictEqual(edges[i]);
      } else {
        expect(newEdges.length, `${i}`).toBe(0);
      }

      if (hasPreviousPage) {
        expect(pagination?.hasPreviousPage, `${i}`).toBe(true);
        expect(pagination?.hasNextPage, `${i}`).toBe(false);
      } else {
        expect(pagination?.hasPreviousPage, `${i}`).toBe(undefined);
        expect(pagination?.hasNextPage, `${i}`).toBe(undefined);
      }
      const orderby = reverseOrderBy(opts.orderby);
      if (cursor) {
        verifyLastBeforeCursorQuery(query!, {
          length: 1,
          limit: pageLength,
          orderby,
        });
      } else {
        verifyQuery(query!, {
          orderby,
          limit: pageLength,
        });
      }
    }
    function getCursor(edge: TData) {
      return query.getCursor(edge);
    }
    return { verify, getCursor };
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

  describe("simple queries", () => {
    const filter = new TestQueryFilter(
      (q: EdgeQuery<FakeUser, FakeContact, TData>) => {
        // no filters
        return q;
      },
      opts.newQuery,
      (contacts: FakeContact[]) => {
        // nothing to do here
        // reverse because edges are most recent first
        if (opts.orderby[0].direction === "DESC") {
          return contacts.reverse();
        }
        return contacts;
      },
      getViewer(),
    );

    beforeEach(async () => {
      await filter.createData();
    });

    test("ids", async () => {
      await filter.testIDs();
      verifyQuery(filter, {});
    });

    test("rawCount", async () => {
      await filter.testRawCount();
      verifyCountQuery({});
    });

    test("count", async () => {
      await filter.testCount();
      verifyQuery(filter, {});
    });

    test("edges", async () => {
      await filter.testEdges();
      verifyQuery(filter, {});
    });

    test("ents", async () => {
      await filter.testEnts();
      verifyQuery(filter, { length: opts.entsLength });
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

  describe("override default limit", () => {
    const filter = new TestQueryFilter(
      (q: EdgeQuery<FakeUser, FakeContact, TData>) => {
        // no filters
        return q;
      },
      opts.newQuery,
      (contacts: FakeContact[]) => {
        // nothing to do here
        // reverse because edges are most recent first
        if (opts.orderby[0].direction === "DESC") {
          return contacts.reverse();
        }
        return contacts;
      },
      getViewer(),
    );

    const OUR_DEFAULT_LIMIT = 10;

    beforeAll(async () => {
      setDefaultLimit(OUR_DEFAULT_LIMIT);
    });

    afterAll(async () => {
      //set it back to real default
      setDefaultLimit(1000);
    });

    beforeEach(async () => {
      await filter.createData();
    });

    test("ids", async () => {
      await filter.testIDs();
      verifyQuery(filter, {
        limit: OUR_DEFAULT_LIMIT,
      });
    });

    test("rawCount", async () => {
      await filter.testRawCount();
      verifyCountQuery({});
    });

    test("count", async () => {
      await filter.testCount();
      verifyQuery(filter, {
        limit: OUR_DEFAULT_LIMIT,
      });
    });

    test("edges", async () => {
      await filter.testEdges();
      verifyQuery(filter, {
        limit: OUR_DEFAULT_LIMIT,
      });
    });

    test("ents", async () => {
      await filter.testEnts();
      verifyQuery(filter, {
        length: opts.entsLength,
        limit: OUR_DEFAULT_LIMIT,
      });
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
            opts.contactSchemaForDeletionTest ?? FakeContactSchema,
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
      verifyQuery(filter, {});
    });

    test("rawCount", async () => {
      await filter.testRawCount(0);
      verifyCountQuery({});
    });

    test("count", async () => {
      await filter.testCount(0);
      verifyQuery(filter, {});
    });

    test("edges", async () => {
      await filter.testEdges();
      verifyQuery(filter, {});
    });

    test("ents", async () => {
      await filter.testEnts();
      // no ents so no subsequent query. just the edge query
      verifyQuery(filter, { length: 1 });
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
        if (opts.orderby[0].direction === "DESC") {
          return contacts.reverse().slice(0, N);
        }
        return contacts.slice(0, N);
      },
      getViewer(),
    );

    beforeEach(async () => {
      await filter.createData();
    });

    test("ids", async () => {
      await filter.testIDs();
      verifyQuery(filter, { limit: 2 });
    });

    test("rawCount", async () => {
      await filter.testRawCount();
      verifyCountQuery({});
    });

    test("count", async () => {
      await filter.testCount();
      verifyQuery(filter, { limit: 2 });
    });

    test("edges", async () => {
      await filter.testEdges();
      verifyQuery(filter, { limit: 2 });
    });

    test("ents", async () => {
      await filter.testEnts();
      verifyQuery(filter, { limit: 2, length: opts.entsLength });
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
        if (opts.orderby[0].direction === "DESC") {
          return contacts.slice(0, N);
        } else {
          return contacts.reverse().slice(0, N);
        }
      },
      getViewer(),
    );
    const orderby = reverseOrderBy(opts.orderby);

    beforeEach(async () => {
      await filter.createData();
    });

    test("ids", async () => {
      await filter.testIDs();
      verifyQuery(filter, {
        orderby,
        limit: N,
      });
    });

    test("rawCount", async () => {
      await filter.testRawCount();
      verifyCountQuery({});
    });

    test("count", async () => {
      await filter.testCount();
      verifyQuery(filter, { orderby, limit: N });
    });

    test("edges", async () => {
      await filter.testEdges();
      verifyQuery(filter, { orderby, limit: N });
    });

    test("ents", async () => {
      await filter.testEnts();
      verifyQuery(filter, {
        orderby,
        limit: N,
        length: opts.entsLength,
      });
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
        return q.first(N, getCursorFrom(q, contacts, idx));
      },
      opts.newQuery,
      (contacts: FakeContact[]) => {
        if (opts.orderby[0].direction === "DESC") {
          // < check so we shouldn't get that index
          return contacts.reverse().slice(idx + 1, idx + N);
        } else {
          return contacts.slice(idx + 1, idx + N);
        }
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
      verifyFirstAfterCursorQuery(filter);
    });

    test("rawCount", async () => {
      await filter.testRawCount();
      verifyCountQuery({});
    });

    test("count", async () => {
      await filter.testCount();
      verifyFirstAfterCursorQuery(filter);
    });

    test("edges", async () => {
      await filter.testEdges();
      verifyFirstAfterCursorQuery(filter);
    });

    test("ents", async () => {
      await filter.testEnts();
      verifyFirstAfterCursorQuery(filter, opts.entsLength);
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
    let [user] = await createAllContacts();
    const edges = await opts.newQuery(getViewer(), user).queryEdges();

    const { verify, getCursor } = getVerifyAfterEachCursor(edges, 1, user);

    await verify(0, true, true, undefined);
    await verify(1, true, true, getCursor(edges[0]));
    await verify(2, true, true, getCursor(edges[1]));
    await verify(3, true, true, getCursor(edges[2]));
    await verify(4, true, false, getCursor(edges[3]));
    await verify(5, false, false, getCursor(edges[4]));
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
        return q.last(N, getCursorFrom(q, contacts, idx));
      },
      opts.newQuery,
      (contacts: FakeContact[]) => {
        // > check so we don't want that index
        if (opts.orderby[0].direction === "DESC") {
          return contacts.reverse().slice(0, idx).reverse(); // because of order returned
        }
        return contacts.slice(0, idx).reverse(); // because of order returned
      },
      getViewer(),
    );
    const orderby = reverseOrderBy(opts.orderby);

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
      verifyLastBeforeCursorQuery(filter, { orderby });
    });

    test("rawCount", async () => {
      await filter.testRawCount();
      verifyCountQuery({});
    });

    test("count", async () => {
      await filter.testCount();
      verifyLastBeforeCursorQuery(filter, { orderby });
    });

    test("edges", async () => {
      await filter.testEdges();
      verifyLastBeforeCursorQuery(filter, { orderby });
    });

    test("ents", async () => {
      await filter.testEnts();
      verifyLastBeforeCursorQuery(filter, { orderby });
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
    let [user] = await createAllContacts();
    const edges = await opts.newQuery(getViewer(), user).queryEdges();

    const { verify, getCursor } = getVerifyBeforeEachCursor(edges, 1, user);

    await verify(4, true, true, undefined);
    await verify(3, true, true, getCursor(edges[4]));
    await verify(2, true, true, getCursor(edges[3]));
    await verify(1, true, true, getCursor(edges[2]));
    await verify(0, true, false, getCursor(edges[1]));
    await verify(-1, false, false, getCursor(edges[0]));
  });

  describe("with conflicts", () => {
    let user: FakeUser;
    let allEdges: TData[] = [];
    beforeEach(async () => {
      const [u, contacts] = await createAllContacts();
      user = u;
      const [_, contacts2] = await createAllContacts({
        user,
        start: contacts[contacts.length - 1].createdAt.getTime() - 86400,
      });
      await createAllContacts({
        user,
        start: contacts2[contacts.length - 1].createdAt.getTime() - 86400,
      });

      const edges = await opts.newQuery(getViewer(), user).queryEdges();

      // confirm there are duplicates...
      expect(edges[4].created_at).toStrictEqual(edges[5].created_at);
      expect(edges[9].created_at).toStrictEqual(edges[10].created_at);
      allEdges = edges;
    });

    test("first after each cursor", async () => {
      const { verify, getCursor } = getVerifyAfterEachCursor(allEdges, 5, user);

      // regular pagination
      await verify(0, true, true, undefined);
      await verify(5, true, true, getCursor(allEdges[4]));
      await verify(10, true, false, getCursor(allEdges[9]));
      await verify(15, false, false, getCursor(allEdges[14]));

      // one without duplicates work if we were paginating at a different place...
      await verify(6, true, true, getCursor(allEdges[5]));
      await verify(11, true, false, getCursor(allEdges[10]));
    });

    test("last before each cursor", async () => {
      const { verify, getCursor } = getVerifyBeforeEachCursor(
        allEdges,
        5,
        user,
      );

      await verify(14, true, true, undefined);
      await verify(13, true, true, getCursor(allEdges[14]));
      await verify(8, true, true, getCursor(allEdges[9]));
      await verify(9, true, true, getCursor(allEdges[10]));
      await verify(3, true, false, getCursor(allEdges[4]));
      await verify(4, true, false, getCursor(allEdges[5]));
    });
  });
};

// TODO parse_sql group by...
// or test it with real db...
