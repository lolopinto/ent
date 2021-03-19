import { QueryRecorder } from "../../testutils/db_mock";
import { Data, ID, Viewer, DefaultLimit, AssocEdge } from "../ent";
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
} from "../../testutils/fake_data/test_helpers";
import { EdgeQuery } from "./query";

class TestQueryFilter<TData extends Data> {
  private contacts: FakeContact[] = [];
  private user: FakeUser;
  constructor(
    private filter: (
      q: EdgeQuery<FakeContact, TData>,
      user: FakeUser,
    ) => EdgeQuery<FakeContact, TData>,
    private newQuery: (
      v: Viewer,
      user: FakeUser,
    ) => EdgeQuery<FakeContact, TData>,
    private ents: (contacts: FakeContact[]) => FakeContact[],
  ) {}

  async beforeEach() {
    //    console.log("sss");
    [this.user, this.contacts] = await createAllContacts();
    //    console.log(this.user, this.contacts);
    this.contacts = this.ents(this.contacts);
    QueryRecorder.clearQueries();
  }

  getQuery(viewer?: Viewer) {
    return this.filter(
      this.newQuery(viewer || new LoggedOutViewer(), this.user),
      this.user,
    );
  }

  async testIDs() {
    const ids = await this.getQuery().queryIDs();
    this.verifyIDs(ids);
  }

  private verifyIDs(ids: ID[]) {
    expect(ids).toStrictEqual(this.contacts.map((contact) => contact.id));
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
    expect(count).toBe(this.contacts.length);
  }

  async testEdges() {
    const edges = await this.getQuery().queryEdges();
    this.verifyEdges(edges);
  }

  private verifyEdges(edges: Data[]) {
    const q = this.getQuery();

    // TODO sad not generic enough
    if (q instanceof UserToContactsFkeyQuery) {
      verifyUserToContactRawData(this.user, edges, this.contacts);
    } else {
      verifyUserToContactEdges(this.user, edges as AssocEdge[], this.contacts);
    }
  }

  async testEnts() {
    const entsMap = await this.getQuery(new IDViewer(this.user.id)).queryEnts();
    this.verifyEnts(entsMap);
  }

  private verifyEnts(ents: FakeContact[]) {
    verifyUserToContacts(this.user, ents, this.contacts);
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
  newQuery: (v: Viewer, user: FakeUser) => EdgeQuery<FakeContact, TData>;
  tableName: string;
  getFilterFn(user: FakeUser): (row: Data) => boolean;

  entsLength?: number;
  where: string;
  sortCol: string;
}

export const commonTests = <TData extends Data>(opts: options<TData>) => {
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
        `${opts.where} ORDER BY ${opts.sortCol} DESC LIMIT ${expLimit}`,
      );
    }
  }

  function verifyCountQuery({ length = 1, numQueries = 1 }) {
    const queries = QueryRecorder.getCurrentQueries();
    expect(queries.length).toBe(length);
    for (let i = 0; i < numQueries; i++) {
      const query = queries[i];
      expect(query.qs?.whereClause).toBe(opts.where);
      expect(query.qs?.columns).toHaveLength(1);
      expect(query.qs?.columns).toStrictEqual(["count(1)"]);
    }
  }

  function verifyFirstAfterCursorQuery(length: number = 1) {
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

  describe("simple queries", () => {
    const filter = new TestQueryFilter(
      (q: EdgeQuery<FakeContact, TData>) => {
        // no filters
        return q;
      },
      opts.newQuery,
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
      verifyQuery({ length: opts.entsLength });
    });

    test("all", async () => {
      await filter.testAll();
    });
  });

  describe("first. no cursor", () => {
    const N = 2;
    const filter = new TestQueryFilter(
      (q: EdgeQuery<FakeContact, TData>) => {
        // no filters
        return q.first(N);
      },
      opts.newQuery,

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
      verifyQuery({ limit: 2, length: opts.entsLength });
    });

    test("all", async () => {
      await filter.testAll();
    });
  });

  describe("last", () => {
    const N = 2;

    const filter = new TestQueryFilter(
      (q: EdgeQuery<FakeContact, TData>) => {
        // no filters
        return q.last(N);
      },
      opts.newQuery,
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
      verifyQuery({ disablePaginationBump: true, length: opts.entsLength });
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
      (q: EdgeQuery<FakeContact, TData>, user: FakeUser) => {
        rows = QueryRecorder.filterData(
          opts.tableName,
          opts.getFilterFn(user),
        ).reverse(); // need to reverse
        //        console.log(rows);
        const cursor = q.getCursor(rows[idx] as TData);

        return q.first(N, cursor);
      },
      opts.newQuery,
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
      verifyFirstAfterCursorQuery(opts.entsLength);
    });

    test("all", async () => {
      await filter.testAll();
    });
  });

  test("first. after each cursor", async () => {
    let [user, contacts] = await createAllContacts();
    contacts = contacts.reverse();
    const edges = await opts.newQuery(new LoggedOutViewer(), user).queryEdges();

    let query: EdgeQuery<FakeContact, Data>;

    async function verify(
      i: number,
      hasEdge: boolean,
      hasNextPage: boolean,
      cursor?: string,
    ) {
      query = opts.newQuery(new LoggedOutViewer(), user);
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
    let rows: Data[] = [];
    const filter = new TestQueryFilter(
      (q: EdgeQuery<FakeContact, TData>, user: FakeUser) => {
        rows = QueryRecorder.filterData(
          opts.tableName,
          opts.getFilterFn(user),
        ).reverse(); // need to reverse
        const cursor = q.getCursor(rows[idx] as TData);

        return q.last(N, cursor);
      },
      opts.newQuery,
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
      verifyLastBeforeCursorQuery(opts.entsLength);
    });

    test("all", async () => {
      await filter.testAll();
    });
  });

  test("last. before each cursor", async () => {
    let [user, contacts] = await createAllContacts();
    contacts = contacts.reverse();
    const edges = await opts.newQuery(new LoggedOutViewer(), user).queryEdges();

    let query: EdgeQuery<FakeContact, Data>;
    async function verify(
      i: number,
      hasEdge: boolean,
      hasPreviousPage: boolean,
      cursor?: string,
    ) {
      query = opts.newQuery(new LoggedOutViewer(), user);
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
