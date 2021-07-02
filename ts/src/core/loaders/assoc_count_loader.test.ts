import { v4 as uuidv4 } from "uuid";

import { TestContext } from "../../testutils/context/test_context";
import { setLogLevels } from "../logger";
import { MockLogs } from "../../testutils/mock_log";
import { ID } from "../base";
import { buildQuery } from "../ent";

import * as clause from "../clause";

import { setupSqlite, TempDB } from "../../testutils/db/test_db";
import { EdgeType, FakeContact } from "../../testutils/fake_data/index";
import {
  createAllContacts,
  setupTempDB,
  tempDBTables,
} from "../../testutils/fake_data/test_helpers";
import { AssocEdgeCountLoader } from "./assoc_count_loader";

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
    setLogLevels(["query", "error"]);
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

describe("sqlite", () => {
  setupSqlite(`sqlite:///assoc_count_loader.db`, tempDBTables);

  beforeAll(async () => {
    setLogLevels(["query", "error"]);
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

  test("without context. cache hit. multi -ids", async () => {
    await testMultiQueryDataAvail(
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
      clause: clause.And(
        clause.Eq("id1", id),
        clause.Eq("edge_type", EdgeType.UserToContacts),
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
      const [user, contacts] = await createAllContacts(undefined, count);

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
    clause: clause.And(
      clause.In("id1", ...ids),
      clause.Eq("edge_type", EdgeType.UserToContacts),
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
      clause: clause.And(
        clause.Eq("id1", ids[idx]),
        clause.Eq("edge_type", EdgeType.UserToContacts),
      ),
    });
    expect(log).toStrictEqual({
      query: expQuery,
      values: [ids[idx], EdgeType.UserToContacts],
    });
  });
}
