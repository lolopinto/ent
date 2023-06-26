import { v4 as uuidv4 } from "uuid";

import { TestContext } from "../../testutils/context/test_context";
import { setLogLevels } from "../logger";
import { MockLogs } from "../../testutils/mock_log";
import { AssocEdge, buildQuery, getDefaultLimit } from "../ent";
import {
  clearGlobalSchema,
  setGlobalSchema,
  __hasGlobalSchema,
} from "../global_schema";
import * as clause from "../clause";

import { EdgeQueryableDataOptions, ID, Loader, WriteOperation } from "../base";
import { setupSqlite, TempDB } from "../../testutils/db/temp_db";
import {
  FakeUser,
  FakeContact,
  EdgeType,
  FakeUserSchema,
  CustomEdge,
} from "../../testutils/fake_data/index";
import {
  createAllContacts,
  setupTempDB,
  tempDBTables,
  verifyUserToContactEdges,
  createEdges,
} from "../../testutils/fake_data/test_helpers";

import {
  AssocEdgeLoader,
  AssocEdgeLoaderFactory,
  AssocLoader,
} from "./assoc_edge_loader";
import { testEdgeGlobalSchema } from "../../testutils/test_edge_global_schema";
import { SimpleAction } from "../../testutils/builder";
import { convertDate } from "../convert";
import { DateTime } from "luxon";

const ml = new MockLogs();

let ctx: TestContext;

const getNewLoader = (context: boolean = true) => {
  return new AssocEdgeLoaderFactory(
    EdgeType.UserToContacts,
    AssocEdge,
  ).createLoader(context ? ctx : undefined);
};

const getConfigurableLoader = (
  context: boolean,
  options: EdgeQueryableDataOptions,
) => {
  return new AssocEdgeLoaderFactory(
    EdgeType.UserToContacts,
    CustomEdge,
  ).createConfigurableLoader(options, context ? ctx : undefined);
};

describe("postgres", () => {
  let tdb: TempDB;

  beforeAll(async () => {
    setLogLevels(["query", "error", "cache"]);
    ml.mock();

    tdb = await setupTempDB();
  });

  beforeEach(() => {
    // reset context for each test
    ctx = new TestContext();
  });

  afterEach(() => {
    ml.clear();
  });

  afterAll(async () => {
    ml.restore();
    await tdb.afterAll();
  });
  commonTests();
});

describe("postgres global", () => {
  let tdb: TempDB;

  beforeAll(async () => {
    setLogLevels(["query", "error", "cache"]);
    ml.mock();
    setGlobalSchema(testEdgeGlobalSchema);

    tdb = await setupTempDB(true);
  });

  beforeEach(() => {
    // reset context for each test
    ctx = new TestContext();
  });

  afterEach(() => {
    ml.clear();
  });

  afterAll(async () => {
    ml.restore();
    await tdb.afterAll();
    clearGlobalSchema();
  });
  commonTests();
  globalTests();
});

describe("sqlite", () => {
  setupSqlite(`sqlite:///assoc_edge_loader.db`, tempDBTables, {});

  beforeAll(async () => {
    setLogLevels(["query", "error", "cache"]);
    ml.mock();
  });

  beforeEach(async () => {
    // reset context for each test
    ctx = new TestContext();
    await createEdges();
  });

  afterEach(() => {
    ml.clear();
  });

  afterAll(async () => {
    ml.restore();
  });
  commonTests();
});

describe("sqlite global ", () => {
  setupSqlite(
    `sqlite:///assoc_edge_loader_global.db`,
    () => tempDBTables(true),
    {},
  );

  beforeAll(async () => {
    setLogLevels(["query", "error", "cache"]);
    setGlobalSchema(testEdgeGlobalSchema);

    ml.mock();
  });

  beforeEach(async () => {
    // reset context for each test
    ctx = new TestContext();
    await createEdges();
  });

  afterEach(() => {
    ml.clear();
  });

  afterAll(async () => {
    ml.restore();
    clearGlobalSchema();
  });
  commonTests();
  globalTests();
});

function commonTests() {
  test("multi-ids. with context", async () => {
    await testMultiQueryDataAvail(
      (opts) => getConfigurableLoader(true, opts),
      (ids) => {
        expect(ml.logs.length).toBe(1);
        expect(ml.logs[0].query).toMatch(/^SELECT * /);
        expect(ml.logs[0].values).toEqual([...ids, EdgeType.UserToContacts]);
      },
      verifyGroupedCacheHit,
    );
  });

  test("multi-ids. with context and deletion", async () => {
    await testWithDeleteMultiQueryDataAvail(
      (opts) => getConfigurableLoader(true, opts),
      (ids) => {
        expect(ml.logs.length).toBe(1);
        expect(ml.logs[0].query).toMatch(/^SELECT * /);
        expect(ml.logs[0].values).toEqual([...ids, EdgeType.UserToContacts]);
      },
      (ids) => {
        // 1 query again since there was a write and should have cleared context cache
        expect(ml.logs.length).toBe(1);
        expect(ml.logs[0].query).toMatch(/^SELECT * /);
        expect(ml.logs[0].values).toEqual([...ids, EdgeType.UserToContacts]);
      },
    );
  });

  test("multi-ids. without context", async () => {
    await testMultiQueryDataAvail(
      (opts) => getConfigurableLoader(false, opts),
      verifyMultiCountQueryCacheMiss,
      verifyMultiCountQueryCacheMiss,
    );
  });

  test("multi-ids. without context and deletion", async () => {
    await testWithDeleteMultiQueryDataAvail(
      (opts) => getConfigurableLoader(false, opts),
      verifyMultiCountQueryCacheMiss,
      verifyMultiCountQueryCacheMiss,
    );
  });

  test("multi-ids. with context, offset", async () => {
    await testMultiQueryDataOffset(
      (options) => getConfigurableLoader(true, options),
      true,
    );
  });

  test("multi-ids. without context, offset", async () => {
    await testMultiQueryDataOffset((options) =>
      getConfigurableLoader(false, options),
    );
  });

  test("multi-ids. with context different limits", async () => {
    let data = await createData();

    // initial. default limit
    await testMultiQueryDataAvail(
      (opts) => getConfigurableLoader(true, opts),
      (ids) => {
        expect(ml.logs.length).toBe(1);
        expect(ml.logs[0].query).toMatch(/^SELECT * /);
        expect(ml.logs[0].values).toEqual([...ids, EdgeType.UserToContacts]);
      },
      verifyGroupedCacheHit,
      undefined,
      data,
    );

    // query again with same data and same limit and it should all be cache hits
    await testMultiQueryDataAvail(
      (opts) => getConfigurableLoader(true, opts),
      verifyGroupedCacheHit,
      verifyGroupedCacheHit,
      undefined,
      data,
    );

    // change slice e.g. first N and now we hit the db again

    await testMultiQueryDataAvail(
      (opts) => getConfigurableLoader(true, opts),
      (ids) => {
        expect(ml.logs.length).toBe(1);
        expect(ml.logs[0].query).toMatch(/^SELECT * /);
        expect(ml.logs[0].values).toEqual([...ids, EdgeType.UserToContacts]);
      },
      verifyGroupedCacheHit,
      3,
      data,
    );

    // query for first 3 again and all hits
    await testMultiQueryDataAvail(
      (opts) => getConfigurableLoader(true, opts),
      verifyGroupedCacheHit,
      verifyGroupedCacheHit,
      3,
      data,
    );

    // change slice e.g. first N and now we hit the db again
    await testMultiQueryDataAvail(
      (opts) => getConfigurableLoader(true, opts),
      (ids) => {
        expect(ml.logs.length).toBe(1);
        expect(ml.logs[0].query).toMatch(/^SELECT * /);
        expect(ml.logs[0].values).toEqual([...ids, EdgeType.UserToContacts]);
      },
      verifyGroupedCacheHit,
      2,
      data,
    );
  });

  test("multi-ids. with no context different limits", async () => {
    let data = await createData();

    // initial. default limit
    await testMultiQueryDataAvail(
      (opts) => getConfigurableLoader(false, opts),
      verifyMultiCountQueryCacheMiss,
      verifyMultiCountQueryCacheMiss,
      undefined,
      data,
    );

    // // query again with same data and same limit and still we refetch it all
    await testMultiQueryDataAvail(
      (opts) => getConfigurableLoader(false, opts),
      verifyMultiCountQueryCacheMiss,
      verifyMultiCountQueryCacheMiss,
      undefined,
      data,
    );

    // change slice e.g. first N and now we hit the db again
    await testMultiQueryDataAvail(
      (opts) => getConfigurableLoader(false, opts),
      verifyMultiCountQueryCacheMiss,
      verifyMultiCountQueryCacheMiss,
      3,
      data,
    );

    // refetch for 3. hit db again
    await testMultiQueryDataAvail(
      (opts) => getConfigurableLoader(false, opts),
      verifyMultiCountQueryCacheMiss,
      verifyMultiCountQueryCacheMiss,
      3,
      data,
    );

    // change slice e.g. first N and now we hit the db again
    await testMultiQueryDataAvail(
      (opts) => getConfigurableLoader(false, opts),
      verifyMultiCountQueryCacheMiss,
      verifyMultiCountQueryCacheMiss,
      3,
      data,
    );
  });

  test("with context. cache hit single id", async () => {
    const [user, contacts] = await createAllContacts();
    ml.clear();
    const loader = getNewLoader();
    const edges = await loader.load(user.id);
    verifyUserToContactEdges(user, edges, contacts.reverse());
    verifyMultiCountQueryCacheMiss([user.id]);

    ml.clear();
    const edges2 = await loader.load(user.id);
    expect(edges).toStrictEqual(edges2);

    //  verifyUserToContactEdges(user, edges2, contacts.reverse());
    verifyGroupedCacheHit([user.id]);
  });

  test("with context. cache hit single id. loader function passed", async () => {
    const loader = new AssocEdgeLoaderFactory(
      EdgeType.UserToContacts,
      () => AssocEdge,
    ).createLoader(ctx);
    const [user, contacts] = await createAllContacts();
    ml.clear();
    const edges = await loader.load(user.id);
    verifyUserToContactEdges(user, edges, contacts.reverse());
    verifyMultiCountQueryCacheMiss([user.id]);

    ml.clear();
    const edges2 = await loader.load(user.id);
    expect(edges).toStrictEqual(edges2);

    //  verifyUserToContactEdges(user, edges2, contacts.reverse());
    verifyGroupedCacheHit([user.id]);
  });

  test("without context. cache hit single id", async () => {
    const [user, contacts] = await createAllContacts();
    ml.clear();
    const loader = getNewLoader(false);
    const edges = await loader.load(user.id);
    verifyUserToContactEdges(user, edges, contacts.reverse());
    verifyMultiCountQueryCacheMiss([user.id]);

    ml.clear();
    const edges2 = await loader.load(user.id);
    expect(edges).toStrictEqual(edges2);

    //  verifyUserToContactEdges(user, edges2, contacts.reverse());
    verifyMultiCountQueryCacheMiss([user.id]);
  });

  test("without context. cache hit single id.loader function passed", async () => {
    const [user, contacts] = await createAllContacts();
    ml.clear();
    const loader = new AssocEdgeLoaderFactory(
      EdgeType.UserToContacts,
      () => AssocEdge,
    ).createLoader();
    const edges = await loader.load(user.id);
    verifyUserToContactEdges(user, edges, contacts.reverse());
    verifyMultiCountQueryCacheMiss([user.id]);

    ml.clear();
    const edges2 = await loader.load(user.id);
    expect(edges).toStrictEqual(edges2);

    //  verifyUserToContactEdges(user, edges2, contacts.reverse());
    verifyMultiCountQueryCacheMiss([user.id]);
  });

  test("with context. cache miss single id", async () => {
    const id = uuidv4();
    ml.clear();
    const loader = getNewLoader();
    const edges = await loader.load(id);
    expect(edges.length).toBe(0);
    verifyMultiCountQueryCacheMiss([id]);

    ml.clear();
    const edges2 = await loader.load(id);
    expect(edges).toStrictEqual(edges2);

    verifyGroupedCacheHit([id]);
  });

  test("without context. cache miss single id", async () => {
    const id = uuidv4();
    ml.clear();
    const loader = getNewLoader(false);
    const edges = await loader.load(id);
    expect(edges.length).toBe(0);
    verifyMultiCountQueryCacheMiss([id]);

    ml.clear();
    const edges2 = await loader.load(id);
    expect(edges).toStrictEqual(edges2);

    verifyMultiCountQueryCacheMiss([id]);
  });
}

function globalTests() {
  test("multi-ids. with context and reload with deleted", async () => {
    await testWithDeleteMultiQueryDataLoadDeleted(
      (opts) => getConfigurableLoader(true, opts),
      (ids) => {
        expect(ml.logs.length).toBe(1);
        expect(ml.logs[0].query).toMatch(/^SELECT * /);
        expect(ml.logs[0].values).toEqual([...ids, EdgeType.UserToContacts]);
      },
      (ids) => {
        // 1 query again since there was a write and should have cleared context cache
        expect(ml.logs.length).toBe(1);
        expect(ml.logs[0].query).toMatch(/^SELECT * /);
        expect(ml.logs[0].values).toEqual([...ids, EdgeType.UserToContacts]);
      },
    );
  });

  test("multi-ids. without context and reload with deleted", async () => {
    await testWithDeleteMultiQueryDataLoadDeleted(
      (opts) => getConfigurableLoader(false, opts),
      verifyMultiCountQueryCacheMiss,
      verifyMultiCountQueryCacheMiss,
    );
  });

  test("single id. with context and reload with deleted", async () => {
    await testWithDeleteSingleQueryDataLoadDeleted(
      (opts) => getConfigurableLoader(true, opts),
      verifyMultiCountQueryCacheMiss,
      verifyMultiCountQueryCacheMiss,
    );
  });

  test("single id. without context and reload with deleted", async () => {
    await testWithDeleteSingleQueryDataLoadDeleted(
      (opts) => getConfigurableLoader(false, opts),
      verifyMultiCountQueryCacheMiss,
      verifyMultiCountQueryCacheMiss,
    );
  });

  async function verifyLoadID2(
    loaderFn: (opts: EdgeQueryableDataOptions) => AssocLoader<CustomEdge>,
  ) {
    const [user, contacts] = await createAllContacts({
      ctx,
    });
    ml.clear();
    const loader = loaderFn({});
    const edges = await loader.load(user.id);
    verifyUserToContactEdges(user, edges, contacts.reverse());
    verifyMultiCountQueryCacheMiss([user.id]);

    const action = new SimpleAction(
      user.viewer,
      FakeUserSchema,
      new Map(),
      WriteOperation.Edit,
      user,
    );

    const id2Edge = await loader.loadEdgeForID2(user.id, edges[0].id2);
    expect(id2Edge).toStrictEqual(edges[0]);

    // delete edges
    for (const edge of edges) {
      expect(edge.deleted_at).toBeNull();
      action.builder.orchestrator.removeOutboundEdge(
        edge.id2,
        EdgeType.UserToContacts,
      );
    }
    await action.saveX();
    ml.clear();
    loader.clearAll();
    user.viewer.context?.cache?.clearCache();
    // do edge writes not call mutateRow???
    // why isn't this done automatically...

    const loader2 = loaderFn({
      disableTransformations: true,
    });

    const id2Edge2 = await loader2.loadEdgeForID2(user.id, edges[0].id2);
    expect(id2Edge2).toBeDefined();
    expect(DateTime.fromJSDate(convertDate(id2Edge2!.deleted_at)).isValid).toBe(
      true,
    );

    // without transformation, returns nothing
    const id2Edge3 = await loader.loadEdgeForID2(user.id, edges[0].id2);
    expect(id2Edge3).toBeUndefined();
  }

  test("load id2 with context", async () => {
    await verifyLoadID2((opts) => getConfigurableLoader(true, opts));
  });

  test("load id2 without context", async () => {
    await verifyLoadID2((opts) => getConfigurableLoader(false, opts));
  });
}

interface createdData {
  m: Map<ID, FakeContact[]>;
  ids: ID[];
  users: FakeUser[];
}

async function createData(): Promise<createdData> {
  const m = new Map<ID, FakeContact[]>();
  const ids: ID[] = [];
  const users: FakeUser[] = [];

  await Promise.all(
    [1, 2, 3, 4, 5].map(async (count, idx) => {
      let [user, contacts] = await createAllContacts({ slice: count });

      m.set(user.id, contacts.reverse());
      ids[idx] = user.id;
      users[idx] = user;
    }),
  );
  return { m, ids, users };
}

async function testMultiQueryDataAvail(
  loaderFn: (opts: EdgeQueryableDataOptions) => Loader<ID, AssocEdge[]>,
  verifyPostFirstQuery: (ids: ID[], slice?: number) => void,
  verifyPostSecondQuery: (ids: ID[], slice?: number) => void,
  slice?: number,
  data?: createdData,
) {
  if (!data) {
    data = await createData();
  }
  let { m, ids, users } = data;

  // clear post creation
  ml.clear();

  // TODO this needs to be done prior to the JS event loop
  // need to make this work for scenarios where the loader is created in same loop
  const loader = loaderFn({
    limit: slice,
  });
  const edges = await Promise.all(ids.map(async (id) => loader.load(id)));
  ml.verifyNoErrors();

  verifyGroupedData(ids, users, edges, m, slice);

  verifyPostFirstQuery(ids, slice);

  ml.clear();

  // reload data
  const edges2 = await Promise.all(ids.map(async (id) => loader.load(id)));

  //verifyGroupedData(ids, users, edges2, m);
  // same data
  expect(edges).toStrictEqual(edges2);

  verifyPostSecondQuery(ids, slice);
}

async function testWithDeleteMultiQueryDataAvail(
  loaderFn: (opts: EdgeQueryableDataOptions) => Loader<ID, AssocEdge[]>,
  verifyPostFirstQuery: (ids: ID[], slice?: number) => void,
  verifyPostSecondQuery: (ids: ID[], slice?: number) => void,
  slice?: number,
  data?: createdData,
) {
  if (!data) {
    data = await createData();
  }
  let { m, ids, users } = data;

  // clear post creation
  ml.clear();

  // TODO this needs to be done prior to the JS event loop
  // need to make this work for scenarios where the loader is created in same loop
  const loader = loaderFn({
    limit: slice,
  });
  const edges = await Promise.all(ids.map(async (id) => loader.load(id)));
  ml.verifyNoErrors();

  verifyGroupedData(ids, users, edges, m, slice);

  verifyPostFirstQuery(ids, slice);

  // delete
  const userToDelete = data.users[0];
  const action = new SimpleAction(
    userToDelete.viewer,
    FakeUserSchema,
    new Map(),
    WriteOperation.Edit,
    userToDelete,
  );
  for (const edge of edges[0]) {
    action.builder.orchestrator.removeOutboundEdge(
      edge.id2,
      EdgeType.UserToContacts,
    );
  }
  await action.saveX();
  ml.clear();

  // clear loader
  loader.clearAll();
  // reload data
  const edges2 = await Promise.all(ids.map(async (id) => loader.load(id)));

  // deleted everything
  // verify data is as expected
  m.set(userToDelete.id, []);

  verifyGroupedData(ids, users, edges2, m);

  verifyPostSecondQuery(ids, slice);
}

async function testWithDeleteMultiQueryDataLoadDeleted(
  loaderFn: (opts: EdgeQueryableDataOptions) => Loader<ID, CustomEdge[]>,
  verifyPostFirstQuery: (ids: ID[], slice?: number) => void,
  verifyPostSecondQuery: (
    ids: ID[],
    slice?: number,
    disableTransformations?: boolean,
  ) => void,
) {
  const data = await createData();
  let { m, ids, users } = data;

  // clear post creation
  ml.clear();

  // TODO this needs to be done prior to the JS event loop
  // need to make this work for scenarios where the loader is created in same loop
  const loader = loaderFn({});
  const edges = await Promise.all(ids.map(async (id) => loader.load(id)));
  ml.verifyNoErrors();

  verifyGroupedData(ids, users, edges, m);

  verifyPostFirstQuery(ids);

  // delete
  const userToDelete = data.users[data.users.length - 1];
  const action = new SimpleAction(
    userToDelete.viewer,
    FakeUserSchema,
    new Map(),
    WriteOperation.Edit,
    userToDelete,
  );

  // delete edges of last one
  for (const edge of edges[edges.length - 1]) {
    action.builder.orchestrator.removeOutboundEdge(
      edge.id2,
      EdgeType.UserToContacts,
    );
  }
  await action.saveX();
  ml.clear();

  // clear loader
  loader.clearAll();

  const loader2 = loaderFn({
    disableTransformations: true,
  });
  // reload data
  const edges2 = await Promise.all(ids.map(async (id) => loader2.load(id)));

  verifyGroupedData(ids, users, edges2, m);

  // verify deleted_at = null for these ids
  for (const edge of edges2[edges.length - 1]) {
    expect(DateTime.fromJSDate(convertDate(edge.deleted_at)).isValid).toBe(
      true,
    );
  }

  // flag disableTransformations
  verifyPostSecondQuery(ids, undefined, true);
}

async function testWithDeleteSingleQueryDataLoadDeleted(
  loaderFn: (opts: EdgeQueryableDataOptions) => Loader<ID, CustomEdge[]>,
  verifyPostFirstQuery: (ids: ID[], slice?: number) => void,
  verifyPostSecondQuery: (
    ids: ID[],
    slice?: number,
    disableTransformations?: boolean,
  ) => void,
) {
  const [user, contacts] = await createAllContacts();
  ml.clear();
  const loader = loaderFn({});
  const edges = await loader.load(user.id);
  verifyUserToContactEdges(user, edges, contacts.reverse());
  verifyPostFirstQuery([user.id]);

  const action = new SimpleAction(
    user.viewer,
    FakeUserSchema,
    new Map(),
    WriteOperation.Edit,
    user,
  );

  // delete edges
  for (const edge of edges) {
    expect(edge.deleted_at).toBeNull();
    action.builder.orchestrator.removeOutboundEdge(
      edge.id2,
      EdgeType.UserToContacts,
    );
  }
  await action.saveX();
  ml.clear();
  loader.clearAll();

  const loader2 = getConfigurableLoader(true, {
    disableTransformations: true,
  });

  const edges2 = await loader2.load(user.id);

  for (const edge of edges2) {
    expect(DateTime.fromJSDate(convertDate(edge.deleted_at)).isValid).toBe(
      true,
    );
  }
  verifyUserToContactEdges(user, edges2, contacts);
  verifyPostSecondQuery([user.id], undefined, true);

  // without disableTransformations, returns []
  const edges3 = await loader.load(user.id);
  expect(edges3).toEqual([]);
}

async function testMultiQueryDataOffset(
  loaderFn: (opts: EdgeQueryableDataOptions) => Loader<ID, AssocEdge[]>,
  context?: boolean,
) {
  const { m, ids, users } = await createData();

  // clear post creation
  ml.clear();

  const edges = await Promise.all(
    ids.map(async (id) => {
      const contacts = m.get(id) || [];
      const options = {
        // how an offset query works
        // we don't (currently) test greater than but it's the same thing...
        clause: clause.Less("time", contacts[0].createdAt.toISOString()),
        limit: 1,
      };

      const loader = loaderFn(options);
      return loader.load(id);
    }),
  );
  ml.verifyNoErrors();

  // we get one edge for each that returned (other than the one with just one row)
  for (let i = 0; i < ids.length; i++) {
    let expContacts: FakeContact[] = [];
    const user = users[i];

    if (i > 0) {
      expContacts = [(m.get(user.id) || [])[1]];
    }
    expect(
      edges[i].length,
      `count for idx ${i} for id ${ids[0]} was not as expected`,
      // 1 row returned for everything but first one
    ).toBe(expContacts.length);

    // verify the edges are as expected
    // just the one (if result exxists)
    verifyUserToContactEdges(users[i], edges[i], expContacts);
  }
  verifyMultiCountQueryOffset(ids, m);

  ml.clear();

  // reload data
  const edges2 = await Promise.all(
    ids.map(async (id) => {
      const contacts = m.get(id) || [];
      const options = {
        clause: clause.Less("time", contacts[0].createdAt.toISOString()),
        limit: 1,
      };

      const loader = loaderFn(options);
      return loader.load(id);
    }),
  );

  // query again, same data
  // if context, we hit local cache. otherwise, hit db
  expect(edges).toStrictEqual(edges2);
  verifyMultiCountQueryOffset(ids, m, context);
}

function verifyGroupedData(
  ids: ID[],
  users: FakeUser[],
  edges: AssocEdge[][],
  m: Map<ID, FakeContact[]>,
  slice?: number,
) {
  for (let i = 0; i < ids.length; i++) {
    const user = users[i];
    let contacts = m.get(user.id) || [];
    if (slice) {
      contacts = contacts.slice(0, slice);
    }

    expect(
      edges[i].length,
      `count for idx ${i} for id ${ids[0]} was not as expected`,
    ).toBe(contacts.length);

    // verify the edges are as expected

    verifyUserToContactEdges(users[i], edges[i], contacts);
  }
}

function verifyGroupedCacheHit(ids: ID[]) {
  ml.verifyNoErrors();
  expect(ml.logs.length).toBe(ids.length);
  // cache hit for each id
  ml.logs.forEach((log, idx) => {
    expect(log).toStrictEqual({
      "dataloader-cache-hit": ids[idx],
      "tableName": "user_to_contacts_table",
    });
  });
}

// manual fetch, fetch data for each id separately
function verifyMultiCountQueryCacheMiss(
  ids: ID[],
  slice?: number,
  disableTransformations?: boolean,
) {
  expect(ml.logs.length).toBe(ids.length);
  ml.logs.forEach((log, idx) => {
    const expQuery = buildQuery({
      tableName: "user_to_contacts_table",
      fields: [
        "id1",
        "id1_type",
        "edge_type",
        "id2",
        "id2_type",
        "time",
        "data",
        __hasGlobalSchema() ? "deleted_at" : "",
      ].filter((v) => v !== ""),
      clause: clause.AndOptional(
        clause.Eq("id1", ids[idx]),
        clause.Eq("edge_type", EdgeType.UserToContacts),
        __hasGlobalSchema() && !disableTransformations
          ? clause.Eq("deleted_at", null)
          : undefined,
      ),
      orderby: [
        {
          column: "time",
          direction: "DESC",
        },
      ],
      limit: slice || getDefaultLimit(),
    });
    expect(log).toStrictEqual({
      query: expQuery,
      values: [ids[idx], EdgeType.UserToContacts],
    });
  });
}

function verifyMultiCountQueryOffset(
  ids: ID[],
  m: Map<ID, FakeContact[]>,
  cachehit?: boolean,
) {
  expect(ml.logs.length).toBe(ids.length);
  ml.logs.forEach((log, idx) => {
    let contacts = m.get(ids[idx]) || [];
    const fields = [
      "id1",
      "id1_type",
      "edge_type",
      "id2",
      "id2_type",
      "time",
      "data",
      __hasGlobalSchema() ? "deleted_at" : "",
    ].filter((v) => v !== "");
    const cls = clause.AndOptional(
      clause.Eq("id1", ids[idx]),
      clause.Eq("edge_type", EdgeType.UserToContacts),
      clause.Less("time", contacts[0].createdAt.toISOString()),
      __hasGlobalSchema() ? clause.Eq("deleted_at", null) : undefined,
    );
    if (cachehit) {
      // have queried before. we don't hit db again
      expect(log).toStrictEqual({
        "cache-hit": [...fields, cls.instanceKey(), "time DESC"].join(","),
        "tableName": "user_to_contacts_table",
      });

      return;
    }
    const expQuery = buildQuery({
      tableName: "user_to_contacts_table",
      fields: fields,
      clause: cls,
      orderby: [
        {
          column: "time",
          direction: "DESC",
        },
      ],
      limit: 1,
    });
    expect(log).toStrictEqual({
      query: expQuery,
      values: [
        ids[idx],
        EdgeType.UserToContacts,
        contacts[0].createdAt.toISOString(),
      ],
    });
  });
}
