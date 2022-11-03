import { v4 as uuidv4 } from "uuid";

import { TestContext } from "../../testutils/context/test_context";
import { setLogLevels } from "../logger";
import { MockLogs } from "../../testutils/mock_log";
import { ID, WriteOperation } from "../base";
import {
  buildQuery,
  clearGlobalSchema,
  setGlobalSchema,
  __hasGlobalSchema,
} from "../ent";

import * as clause from "../clause";

import { setupSqlite, TempDB } from "../../testutils/db/temp_db";
import {
  EdgeType,
  FakeContact,
  FakeUser,
  FakeUserSchema,
} from "../../testutils/fake_data/index";
import {
  createAllContacts,
  setupTempDB,
  tempDBTables,
} from "../../testutils/fake_data/test_helpers";
import { AssocEdgeCountLoader } from "./assoc_count_loader";
import { testEdgeGlobalSchema } from "../../testutils/test_edge_global_schema";
import { SimpleAction } from "../../testutils/builder";

const ml = new MockLogs();

const getNewLoader = (context: boolean = true) => {
  return new AssocEdgeCountLoader(
    EdgeType.UserToContacts,
    context ? new TestContext() : undefined,
  );
};

describe("postgres", () => {
  let tdb: TempDB;
  beforeAll(async () => {
    setLogLevels(["query", "error", "cache"]);
    ml.mock();

    tdb = await setupTempDB();
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

  afterEach(() => {
    ml.clear();
  });

  afterAll(async () => {
    ml.restore();
    await tdb.afterAll();
    clearGlobalSchema();
  });
  commonTests();
});

describe("sqlite", () => {
  setupSqlite(`sqlite:///assoc_count_loader.db`, tempDBTables);

  beforeAll(async () => {
    setLogLevels(["query", "error", "cache"]);
    ml.mock();
  });

  beforeEach(() => {
    ml.clear();
  });

  afterAll(async () => {
    ml.restore();
  });

  commonTests();
});

describe("sqlite global", () => {
  setupSqlite(`sqlite:///assoc_count_loader_global.db`, () =>
    tempDBTables(true),
  );

  beforeAll(async () => {
    setLogLevels(["query", "error", "cache"]);
    setGlobalSchema(testEdgeGlobalSchema);

    ml.mock();
  });

  beforeEach(() => {
    ml.clear();
  });

  afterAll(async () => {
    ml.restore();
    clearGlobalSchema();
  });

  commonTests();
});

function commonTests() {
  test("with context. cache hit. single id", async () => {
    await verifySingleIDHit(
      getNewLoader,
      verifySingleIDQuery,
      verifySingleIDCacheHit,
    );
  });

  test("with context. cache miss. single id", async () => {
    await verifySingleIDMiss(
      getNewLoader,
      verifySingleIDQuery,
      verifySingleIDCacheHit,
    );
  });

  test("without context. cache hit. single id", async () => {
    await verifySingleIDHit(
      () => getNewLoader(false),
      verifySingleIDQuery,
      verifySingleIDQuery,
    );
  });

  test("without context. cache miss. single id", async () => {
    await verifySingleIDMiss(
      () => getNewLoader(false),
      verifySingleIDQuery,
      verifySingleIDQuery,
    );
  });

  test("with context. cache hit. multi -ids", async () => {
    await testMultiQueryDataAvail(
      getNewLoader,
      verifyGroupedQuery,
      verifyGroupedCacheHit,
    );
  });

  test("with context and deletion. cache hit. multi -ids", async () => {
    await testWithDeleteMultiQueryDataAvail(
      getNewLoader,
      verifyGroupedQuery,
      verifyGroupedQuery,
    );
  });

  test("without context. cache hit. multi -ids", async () => {
    await testMultiQueryDataAvail(
      () => getNewLoader(false),
      verifyMultiCountQueryCacheMiss,
      verifyMultiCountQueryCacheMiss,
    );
  });

  test("without context and deletion. cache hit. multi -ids", async () => {
    await testWithDeleteMultiQueryDataAvail(
      () => getNewLoader(false),
      verifyMultiCountQueryCacheMiss,
      verifyMultiCountQueryCacheMiss,
    );
  });

  test("with context. cache miss. multi -ids", async () => {
    await testMultiQueryNoData(
      getNewLoader,
      verifyGroupedQuery,
      verifyGroupedCacheHit,
    );
  });

  test("without context. cache miss. multi -ids", async () => {
    await testMultiQueryNoData(
      () => getNewLoader(false),
      verifyMultiCountQueryCacheMiss,
      verifyMultiCountQueryCacheMiss,
    );
  });
}

async function verifySingleIDHit(
  loaderFn: () => AssocEdgeCountLoader,
  verifyPostFirstQuery: (id: ID) => void,
  verifyPostSecondQuery: (id: ID) => void,
) {
  const [user, contacts] = await createAllContacts();
  // clear post creation
  ml.clear();

  const loader = loaderFn();
  const count = await loader.load(user.id);
  expect(count).toBe(contacts.length);

  verifyPostFirstQuery(user.id);

  ml.clear();
  const count2 = await loader.load(user.id);
  expect(count2).toBe(count);

  verifyPostSecondQuery(user.id);

  ml.verifyNoErrors();
}

async function verifySingleIDMiss(
  loaderFn: () => AssocEdgeCountLoader,
  verifyPostFirstQuery: (id: ID) => void,
  verifyPostSecondQuery: (id: ID) => void,
) {
  const id = uuidv4();
  // clear post creation
  ml.clear();

  const loader = loaderFn();
  const count = await loader.load(id);
  expect(count).toBe(0);

  verifyPostFirstQuery(id);

  ml.clear();
  const count2 = await loader.load(id);
  expect(count2).toBe(0);

  verifyPostSecondQuery(id);

  ml.verifyNoErrors();
}

function verifySingleIDQuery(id) {
  expect(ml.logs.length).toBe(1);
  expect(ml.logs[0]).toStrictEqual({
    query: buildQuery({
      tableName: "user_to_contacts_table",
      fields: ["count(1) as count"],
      clause: clause.AndOptional(
        clause.Eq("id1", id),
        clause.Eq("edge_type", EdgeType.UserToContacts),
        __hasGlobalSchema() ? clause.Eq("deleted_at", null) : undefined,
      ),
    }),
    values: [id, EdgeType.UserToContacts],
  });
}

function verifySingleIDCacheHit(id) {
  expect(ml.logs.length).toBe(1);
  expect(ml.logs[0]).toStrictEqual({
    "dataloader-cache-hit": id,
    "tableName": "user_to_contacts_table",
  });
}

async function testMultiQueryDataAvail(
  loaderFn: () => AssocEdgeCountLoader,
  verifyPostFirstQuery: (ids: ID[]) => void,
  verifyPostSecondQuery: (ids: ID[]) => void,
) {
  const m = new Map<ID, FakeContact[]>();
  const ids: ID[] = [];

  await Promise.all(
    [1, 2, 3, 4, 5].map(async (count, idx) => {
      const [user, contacts] = await createAllContacts({ slice: count });

      m.set(user.id, contacts);
      ids[idx] = user.id;
    }),
  );

  ml.clear();

  const loader = loaderFn();

  const counts = await Promise.all(ids.map(async (id) => loader.load(id)));
  for (let i = 0; i < ids.length; i++) {
    expect(
      counts[i],
      `count for idx ${i} for id ${ids[0]} was not as expected`,
    ).toBe(m.get(ids[i])?.length);
  }

  verifyPostFirstQuery(ids);

  // clear the logs
  ml.clear();
  // re-load
  const counts2 = await Promise.all(ids.map(async (id) => loader.load(id)));
  for (let i = 0; i < ids.length; i++) {
    expect(
      counts2[i],
      `count for idx ${i} for id ${ids[0]} was not as expected`,
    ).toBe(m.get(ids[i])?.length);
  }

  verifyPostSecondQuery(ids);
}

async function testWithDeleteMultiQueryDataAvail(
  loaderFn: () => AssocEdgeCountLoader,
  verifyPostFirstQuery: (ids: ID[]) => void,
  verifyPostSecondQuery: (ids: ID[]) => void,
) {
  const m = new Map<ID, FakeContact[]>();
  const ids: ID[] = [];
  const users: FakeUser[] = [];

  await Promise.all(
    [1, 2, 3, 4, 5].map(async (count, idx) => {
      const [user, contacts] = await createAllContacts({ slice: count });

      m.set(user.id, contacts);
      ids[idx] = user.id;
      users[idx] = user;
    }),
  );

  ml.clear();

  const loader = loaderFn();

  const counts = await Promise.all(ids.map(async (id) => loader.load(id)));
  for (let i = 0; i < ids.length; i++) {
    expect(
      counts[i],
      `count for idx ${i} for id ${ids[0]} was not as expected`,
    ).toBe(m.get(ids[i])?.length);
  }

  verifyPostFirstQuery(ids);

  const userToDelete = users[0];
  const action = new SimpleAction(
    userToDelete.viewer,
    FakeUserSchema,
    new Map(),
    WriteOperation.Edit,
    userToDelete,
  );
  for (const contact of m.get(userToDelete.id) ?? []) {
    action.builder.orchestrator.removeOutboundEdge(
      contact.id,
      EdgeType.UserToContacts,
    );
  }
  await action.saveX();
  // clear the logs
  ml.clear();
  loader.clearAll();

  // re-load
  const counts2 = await Promise.all(ids.map(async (id) => loader.load(id)));
  for (let i = 0; i < ids.length; i++) {
    const ct = counts2[i];
    if (i === 0) {
      expect(ct).toBe(0);
    } else {
      expect(
        ct,
        `count for idx ${i} for id ${ids[0]} was not as expected`,
      ).toBe(m.get(ids[i])?.length);
    }
  }

  verifyPostSecondQuery(ids);
}

async function testMultiQueryNoData(
  loaderFn: () => AssocEdgeCountLoader,
  verifyPostFirstQuery: (ids: ID[]) => void,
  verifyPostSecondQuery: (ids: ID[]) => void,
) {
  const ids = [uuidv4(), uuidv4(), uuidv4(), uuidv4(), uuidv4()];

  const loader = loaderFn();

  const counts = await Promise.all(ids.map(async (id) => loader.load(id)));
  expect(counts).toStrictEqual([0, 0, 0, 0, 0]);

  verifyPostFirstQuery(ids);

  // clear the logs
  ml.clear();
  // re-load
  const counts2 = await Promise.all(ids.map(async (id) => loader.load(id)));
  expect(counts2).toStrictEqual([0, 0, 0, 0, 0]);

  verifyPostSecondQuery(ids);
}

function verifyGroupedQuery(ids: ID[]) {
  // loader, we combine the query...
  const expQuery = buildQuery({
    tableName: "user_to_contacts_table",
    fields: ["count(1) as count", "id1"],
    clause: clause.AndOptional(
      clause.In("id1", ...ids),
      clause.Eq("edge_type", EdgeType.UserToContacts),
      __hasGlobalSchema() ? clause.Eq("deleted_at", null) : undefined,
    ),
    groupby: "id1",
  });
  expect(ml.logs.length).toBe(1);
  expect(ml.logs[0]).toEqual({
    query: expQuery,
    values: [...ids, EdgeType.UserToContacts],
  });
}

function verifyGroupedCacheHit(ids: ID[]) {
  expect(ml.logs.length).toBe(ids.length);
  // cache hit for each id
  ml.logs.forEach((log, idx) => {
    expect(log).toStrictEqual({
      "dataloader-cache-hit": ids[idx],
      "tableName": "user_to_contacts_table",
    });
  });
}

function verifyMultiCountQueryCacheMiss(ids: ID[]) {
  expect(ml.logs.length).toBe(ids.length);
  ml.logs.forEach((log, idx) => {
    const expQuery = buildQuery({
      tableName: "user_to_contacts_table",
      fields: ["count(1) as count"],
      clause: clause.AndOptional(
        clause.Eq("id1", ids[idx]),
        clause.Eq("edge_type", EdgeType.UserToContacts),
        __hasGlobalSchema() ? clause.Eq("deleted_at", null) : undefined,
      ),
    });
    expect(log).toStrictEqual({
      query: expQuery,
      values: [ids[idx], EdgeType.UserToContacts],
    });
  });
}
