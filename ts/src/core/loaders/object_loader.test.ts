import { ObjectLoader } from "./object_loader";
import { Pool } from "pg";
import { QueryRecorder } from "../../testutils/db_mock";

import { createRowForTest } from "../../testutils/write";
import { TestContext } from "../../testutils/context/test_context";
import { setLogLevels } from "../logger";
import { MockLogs } from "../../testutils/mock_log";
import { ID } from "../base";
import { buildQuery } from "../ent";
import * as clause from "../clause";
jest.mock("pg");
QueryRecorder.mockPool(Pool);

const ml = new MockLogs();
beforeAll(() => {
  setLogLevels("query");
  ml.mock();
});

afterEach(() => {
  QueryRecorder.clear();
  ml.clear();
});

afterAll(() => {
  ml.restore();
});

const getNewLoader = (context: boolean = true) => {
  return new ObjectLoader(
    {
      tableName: "users",
      fields: ["id", "first_name"],
    },
    context ? new TestContext() : undefined,
  );
};

async function create(id?: ID) {
  await createRowForTest({
    tableName: "users",
    fields: {
      id: id || 1,
      first_name: "Jon",
    },
  });

  // clear post insert
  ml.clear();
}

test("with context. cache hit", async () => {
  await create();
  const loader = getNewLoader();

  const row = await loader.load(1);
  expect(row).toStrictEqual({
    id: 1,
    first_name: "Jon",
  });
  const row2 = await loader.load(1);
  expect(row).toBe(row2);
});

test("with context. cache miss", async () => {
  const loader = getNewLoader();

  const expQuery = buildQuery({
    tableName: "users",
    fields: ["id", "first_name"],
    clause: clause.In("id", 1),
  });
  const row = await loader.load(1);

  expect(row).toBe(null);
  expect(ml.logs.length).toBe(1);
  expect(ml.logs[0]).toStrictEqual({
    query: expQuery,
    values: [1],
  });

  const row2 = await loader.load(1);
  expect(row2).toBe(null);
  expect(ml.logs.length).toBe(2);
  expect(ml.logs[1]).toStrictEqual({
    "dataloader-cache-hit": 1,
    "tableName": "users",
  });
});

test("without context. cache hit", async () => {
  await create();

  const loader = getNewLoader(false);

  const row = await loader.load(1);
  expect(row).toStrictEqual({
    id: 1,
    first_name: "Jon",
  });

  const expQuery = buildQuery({
    tableName: "users",
    fields: ["id", "first_name"],
    // no context so just clause.Eq
    clause: clause.Eq("id", 1),
  });
  expect(ml.logs.length).toBe(1);
  expect(ml.logs[0]).toStrictEqual({
    query: expQuery,
    values: [1],
  });

  // same data loaded  but not same row
  const row2 = await loader.load(1);

  expect(row).toStrictEqual(row2);
  expect(row).not.toBe(row2);

  // new query was made
  expect(ml.logs.length).toBe(2);
  expect(ml.logs[1]).toStrictEqual({
    query: expQuery,
    values: [1],
  });
});

test("without context. cache miss", async () => {
  const loader = getNewLoader(false);

  const row = await loader.load(1);
  expect(row).toBeNull();

  const expQuery = buildQuery({
    tableName: "users",
    fields: ["id", "first_name"],
    // no context so just clause.Eq
    clause: clause.Eq("id", 1),
  });
  expect(ml.logs.length).toBe(1);
  expect(ml.logs[0]).toStrictEqual({
    query: expQuery,
    values: [1],
  });

  // same data loaded  but not same row
  const row2 = await loader.load(1);

  expect(row2).toBeNull();

  // new query was made
  expect(ml.logs.length).toBe(2);
  expect(ml.logs[1]).toStrictEqual({
    query: expQuery,
    values: [1],
  });
});

test("multi-ids. with context", async () => {
  await verifyMultiIDsDataAvail(
    getNewLoader,
    verifyMultiIDsGroupQuery,
    verifyMultiIDsCacheHit,
  );
});

test("multi-ids. without context", async () => {
  await verifyMultiIDsDataAvail(
    () => getNewLoader(false),
    verifyMultiIDsGroupQueryMiss,
    verifyMultiIDsGroupQueryMiss,
  );
});

test("multi-ids.no data. with context", async () => {
  await verifyMultiIDsNoDataAvail(
    getNewLoader,
    verifyMultiIDsGroupQuery,
    verifyMultiIDsCacheHit,
  );
});

test("multi-ids. no data. without context", async () => {
  await verifyMultiIDsNoDataAvail(
    () => getNewLoader(false),
    verifyMultiIDsGroupQueryMiss,
    verifyMultiIDsGroupQueryMiss,
  );
});

async function verifyMultiIDsDataAvail(
  loaderFn: () => ObjectLoader,
  verifyPostFirstQuery: (ids: ID[]) => void,
  verifyPostSecondQuery: (ids: ID[]) => void,
) {
  const ids = [1, 2, 3, 4, 5];
  await Promise.all(ids.map((id) => create(id)));
  const loader = loaderFn();

  const rows = await Promise.all(ids.map((id) => loader.load(id)));

  for (let i = 0; i < ids.length; i++) {
    const row = rows[i];
    expect(row).toBeDefined();
    expect(row?.id, `${i}th index`).toEqual(ids[i]);
    expect(row?.first_name).toBe("Jon");
  }
  verifyPostFirstQuery(ids);

  ml.clear();

  const rows2 = await Promise.all(ids.map((id) => loader.load(id)));
  expect(rows).toStrictEqual(rows2);

  verifyPostSecondQuery(ids);
}

async function verifyMultiIDsNoDataAvail(
  loaderFn: () => ObjectLoader,
  verifyPostFirstQuery: (ids: ID[]) => void,
  verifyPostSecondQuery: (ids: ID[]) => void,
) {
  const ids = [1, 2, 3, 4, 5];
  const loader = loaderFn();

  const rows = await Promise.all(ids.map((id) => loader.load(id)));

  for (let i = 0; i < ids.length; i++) {
    const row = rows[i];
    expect(row).toBeNull();
  }
  verifyPostFirstQuery(ids);

  ml.clear();

  const rows2 = await Promise.all(ids.map((id) => loader.load(id)));
  expect(rows).toStrictEqual(rows2);

  verifyPostSecondQuery(ids);
}

function verifyMultiIDsGroupQuery(ids: ID[]) {
  const expQuery = buildQuery({
    tableName: "users",
    fields: ["id", "first_name"],

    clause: clause.In("id", ...ids),
  });

  expect(ml.logs.length).toBe(1);
  expect(ml.logs[0]).toStrictEqual({
    query: expQuery,
    values: ids,
  });
}

function verifyMultiIDsGroupQueryMiss(ids: ID[]) {
  expect(ml.logs.length).toBe(ids.length);
  ml.logs.forEach((log, idx) => {
    const expQuery = buildQuery({
      tableName: "users",
      fields: ["id", "first_name"],

      clause: clause.Eq("id", ids[idx]),
    });
    expect(log).toStrictEqual({
      query: expQuery,
      values: [ids[idx]],
    });
  });
}

function verifyMultiIDsCacheHit(ids: ID[]) {
  expect(ml.logs.length).toBe(ids.length);

  ids.forEach((id, idx) => {
    expect(ml.logs[idx]).toStrictEqual({
      "dataloader-cache-hit": id,
      "tableName": "users",
    });
  });
}
