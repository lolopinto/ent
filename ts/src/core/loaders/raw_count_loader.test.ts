import { RawCountLoader } from "./raw_count_loader";
import { v4 as uuidv4 } from "uuid";

import { TestContext } from "../../testutils/context/test_context";
import { setLogLevels } from "../logger";
import { MockLogs } from "../../testutils/mock_log";
import { ID } from "../base";
import { buildQuery } from "../ent";

import * as clause from "../clause";

import { TempDB } from "../../testutils/db/test_db";
import { FakeContact } from "../../testutils/fake_data/index";
import {
  createAllContacts,
  setupTempDB,
} from "../../testutils/fake_data/test_helpers";

const ml = new MockLogs();
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

const getNewLoader = (context: boolean = true) => {
  return new RawCountLoader(
    {
      tableName: "fake_contacts",
    },
    "user_id",
    context ? new TestContext() : undefined,
  );
};

test("with context. cache hit. single id", async () => {
  const [user, contacts] = await createAllContacts();
  // clear post creation
  ml.clear();

  const loader = getNewLoader();
  const count = await loader.load(user.id);
  expect(count).toBe(contacts.length);

  expect(ml.logs.length).toBe(1);
  expect(ml.logs[0]).toStrictEqual({
    query: buildQuery({
      tableName: "fake_contacts",
      fields: ["count(1)"],
      clause: clause.Eq("user_id", user.id),
    }),
    values: [user.id],
  });

  const count2 = await loader.load(user.id);
  expect(count2).toBe(count);

  // cache hit
  expect(ml.logs.length).toBe(2);
  // This is not the best
  expect(ml.logs[1]).toStrictEqual({
    "dataloader-cache-hit": user.id,
    "tableName": "fake_contacts",
  });

  ml.verifyNoErrors();
});

test("with context. cache miss. single id", async () => {
  const id = uuidv4();

  const loader = getNewLoader();
  const count = await loader.load(id);
  expect(count).toBe(0);

  expect(ml.logs.length).toBe(1);
  expect(ml.logs[0]).toStrictEqual({
    query: buildQuery({
      tableName: "fake_contacts",
      fields: ["count(1)"],
      clause: clause.Eq("user_id", id),
    }),
    values: [id],
  });

  const count2 = await loader.load(id);
  expect(count2).toBe(0);

  // cache hit
  expect(ml.logs.length).toBe(2);
  // This is not the best
  expect(ml.logs[1]).toStrictEqual({
    "dataloader-cache-hit": id,
    "tableName": "fake_contacts",
  });
  ml.verifyNoErrors();
});

test("without context. cache hit. single id", async () => {
  const [user, contacts] = await createAllContacts();
  // clear post creation
  ml.clear();

  const loader = getNewLoader(false);
  const count = await loader.load(user.id);
  expect(count).toBe(contacts.length);

  expect(ml.logs.length).toBe(1);
  expect(ml.logs[0]).toStrictEqual({
    query: buildQuery({
      tableName: "fake_contacts",
      fields: ["count(1)"],
      clause: clause.Eq("user_id", user.id),
    }),
    values: [user.id],
  });

  const count2 = await loader.load(user.id);
  expect(count2).toBe(count);

  expect(ml.logs.length).toBe(2);
  expect(ml.logs[1]).toStrictEqual({
    query: buildQuery({
      tableName: "fake_contacts",
      fields: ["count(1)"],
      clause: clause.Eq("user_id", user.id),
    }),
    values: [user.id],
  });
  ml.verifyNoErrors();
});

test("without context. cache miss. single id", async () => {
  const id = uuidv4();

  const loader = getNewLoader(false);
  const count = await loader.load(id);
  expect(count).toBe(0);

  expect(ml.logs.length).toBe(1);
  expect(ml.logs[0]).toStrictEqual({
    query: buildQuery({
      tableName: "fake_contacts",
      fields: ["count(1)"],
      clause: clause.Eq("user_id", id),
    }),
    values: [id],
  });

  const count2 = await loader.load(id);
  expect(count2).toBe(0);

  expect(ml.logs.length).toBe(2);
  expect(ml.logs[1]).toStrictEqual({
    query: buildQuery({
      tableName: "fake_contacts",
      fields: ["count(1)"],
      clause: clause.Eq("user_id", id),
    }),
    values: [id],
  });
  ml.verifyNoErrors();
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

async function testMultiQueryDataAvail(
  loaderFn: () => RawCountLoader,
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
  loaderFn: () => RawCountLoader,
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
    tableName: "fake_contacts",
    fields: ["count(1)", "user_id"],
    clause: clause.In("user_id", ...ids),
    groupby: "user_id",
  });
  expect(ml.logs.length).toBe(1);
  expect(ml.logs[0]).toEqual({
    query: expQuery,
    values: ids,
  });
}

function verifyGroupedCacheHit(ids: ID[]) {
  expect(ml.logs.length).toBe(ids.length);
  // cache hit for each id
  ml.logs.forEach((log, idx) => {
    expect(log).toStrictEqual({
      "dataloader-cache-hit": ids[idx],
      "tableName": "fake_contacts",
    });
  });
}

function verifyMultiCountQueryCacheMiss(ids: ID[]) {
  expect(ml.logs.length).toBe(ids.length);
  ml.logs.forEach((log, idx) => {
    const expQuery = buildQuery({
      tableName: "fake_contacts",
      fields: ["count(1)"],
      clause: clause.Eq("user_id", ids[idx]),
    });
    expect(log).toStrictEqual({
      query: expQuery,
      values: [ids[idx]],
    });
  });
}
