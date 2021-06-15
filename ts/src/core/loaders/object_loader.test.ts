import { ObjectLoader, ObjectLoaderFactory } from "./object_loader";
import { Pool } from "pg";
import { QueryRecorder } from "../../testutils/db_mock";

import { createRowForTest } from "../../testutils/write";
import { TestContext } from "../../testutils/context/test_context";
import { setLogLevels } from "../logger";
import { MockLogs } from "../../testutils/mock_log";
import { ID } from "../base";
import { buildQuery } from "../ent";
import * as clause from "../clause";
import {
  createTestUser,
  createEdges,
  tempDBTables,
} from "../../testutils/fake_data/test_helpers";
import {
  userLoader,
  userEmailLoader,
  userPhoneNumberLoader,
  FakeUser,
} from "../../testutils/fake_data/";
import { integer, setupSqlite, table, text } from "../../testutils/db/test_db";

jest.mock("pg");
QueryRecorder.mockPool(Pool);

const ml = new MockLogs();

const getNewLoader = (context: boolean = true) => {
  return new ObjectLoader(
    {
      tableName: "users",
      fields: ["id", "first_name"],
      key: "id",
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

describe("postgres", () => {
  beforeAll(async () => {
    setLogLevels("query");
    ml.mock();

    await createEdges();
  });

  afterEach(() => {
    QueryRecorder.clear();
    ml.clear();
  });

  afterAll(() => {
    ml.restore();
  });
  commonTests();
});

describe("sqlite", () => {
  const tables = () => {
    const tables = tempDBTables();
    tables.push(
      table("users", integer("id", { primaryKey: true }), text("first_name")),
    );
    return tables;
  };
  setupSqlite(`sqlite:///object_loader.db`, tables);

  beforeAll(async () => {
    setLogLevels(["query", "error"]);
    ml.mock();
  });

  beforeEach(async () => {
    await createEdges();
    ml.clear();
  });

  afterEach(() => {
    ml.clear();
  });

  afterAll(async () => {
    ml.restore();
  });
  commonTests();
});

function commonTests() {
  test("with context. cache hit", async () => {
    await create();
    const loader = getNewLoader();

    const row = await loader.load(1);
    expect(row).toEqual({
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
    expect(row).toEqual({
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

  describe("primed loaders", () => {
    test("id first", async () => {
      const user = await createTestUser();
      ml.clear();

      const ctx = new TestContext();
      await userLoader.createLoader(ctx).load(user.id);

      expect(ml.logs.length).toBe(1);

      const expQuery = buildQuery({
        ...FakeUser.loaderOptions(),
        clause: clause.In("id", user.id),
      });
      expect(ml.logs[0]).toStrictEqual({
        query: expQuery,
        values: [user.id],
      });

      ml.clear();

      await userPhoneNumberLoader.createLoader(ctx).load(user.phoneNumber);
      expect(ml.logs.length).toBeGreaterThan(1);

      const phoneQuery = buildQuery({
        ...FakeUser.loaderOptions(),
        clause: clause.In("phone_number", user.phoneNumber),
      });
      // because of the nature of the nodejs event loop, we don't know when the priming will fire
      // so all we can easily confirm is that this was primed
      expect(ml.logs).toEqual(
        expect.arrayContaining([
          {
            "dataloader-cache-hit": user.phoneNumber,
            "tableName": "fake_users",
          },
        ]),
      );

      // confirm phone number query not seen
      ml.logs.forEach((log) =>
        expect(log).not.toMatchObject({
          query: phoneQuery,
          values: [user.phoneNumber],
        }),
      );

      ml.clear();

      await userEmailLoader.createLoader(ctx).load(user.emailAddress);
      expect(ml.logs.length).toBeGreaterThan(1);

      const emailQuery = buildQuery({
        ...FakeUser.loaderOptions(),
        clause: clause.In("email_address", user.emailAddress),
      });
      // because of the nature of the nodejs event loop, we don't know when the priming will fire
      // so all we can easily confirm is that this was primed
      expect(ml.logs).toEqual(
        expect.arrayContaining([
          {
            "dataloader-cache-hit": user.emailAddress,
            "tableName": "fake_users",
          },
        ]),
      );

      // confirm email query not seen
      ml.logs.forEach((log) =>
        expect(log).not.toMatchObject({
          query: emailQuery,
          values: [user.emailAddress],
        }),
      );
    });

    // showing order shouldn't matter
    test("other key first", async () => {
      const user = await createTestUser();
      ml.clear();

      const ctx = new TestContext();
      await userPhoneNumberLoader.createLoader(ctx).load(user.phoneNumber);
      expect(ml.logs.length).toBe(1);

      const phoneQuery = buildQuery({
        ...FakeUser.loaderOptions(),
        clause: clause.In("phone_number", user.phoneNumber),
      });

      // confirm phone number query not seen
      expect(ml.logs[0]).toStrictEqual({
        query: phoneQuery,
        values: [user.phoneNumber],
      });

      ml.clear();

      await userLoader.createLoader(ctx).load(user.id);

      expect(ml.logs.length).toBeGreaterThanOrEqual(1);

      // because of the nature of the nodejs event loop, we don't know when the priming will fire
      // so all we can easily confirm is that this was primed
      expect(ml.logs).toEqual(
        expect.arrayContaining([
          {
            "dataloader-cache-hit": user.id,
            "tableName": "fake_users",
          },
        ]),
      );

      const expQuery = buildQuery({
        ...FakeUser.loaderOptions(),
        clause: clause.In("id", user.id),
      });
      // confirm id query not seen
      ml.logs.forEach((log) =>
        expect(log).not.toMatchObject({
          query: expQuery,
          values: [user.id],
        }),
      );
      ml.clear();

      await userEmailLoader.createLoader(ctx).load(user.emailAddress);
      expect(ml.logs.length).toBeGreaterThan(1);

      const emailQuery = buildQuery({
        ...FakeUser.loaderOptions(),
        clause: clause.In("email_address", user.emailAddress),
      });
      // because of the nature of the nodejs event loop, we don't know when the priming will fire
      // so all we can easily confirm is that this was primed
      expect(ml.logs).toEqual(
        expect.arrayContaining([
          {
            "dataloader-cache-hit": user.emailAddress,
            "tableName": "fake_users",
          },
        ]),
      );

      // confirm email query not seen
      ml.logs.forEach((log) =>
        expect(log).not.toMatchObject({
          query: emailQuery,
          values: [user.emailAddress],
        }),
      );
    });
  });

  test("not-primed loaders", async () => {
    const user = await createTestUser();
    ml.clear();

    const ctx = new TestContext();
    const newUserLoader = new ObjectLoaderFactory({
      ...FakeUser.loaderOptions(),
      key: "id",
    });
    const newUserPhoneLoader = new ObjectLoaderFactory({
      ...FakeUser.loaderOptions(),
      key: "phone_number",
    });
    const newUserEmailAddressLoader = new ObjectLoaderFactory({
      ...FakeUser.loaderOptions(),
      key: "email_address",
    });

    await newUserLoader.createLoader(ctx).load(user.id);

    expect(ml.logs.length).toBe(1);

    const expQuery = buildQuery({
      ...FakeUser.loaderOptions(),
      clause: clause.In("id", user.id),
    });
    expect(ml.logs[0]).toStrictEqual({
      query: expQuery,
      values: [user.id],
    });

    ml.clear();

    await newUserPhoneLoader.createLoader(ctx).load(user.phoneNumber);
    expect(ml.logs.length).toBe(1);

    const phoneQuery = buildQuery({
      ...FakeUser.loaderOptions(),
      clause: clause.In("phone_number", user.phoneNumber),
    });

    // confirm phone number query seen
    expect(ml.logs[0]).toStrictEqual({
      query: phoneQuery,
      values: [user.phoneNumber],
    });

    ml.clear();

    await newUserEmailAddressLoader.createLoader(ctx).load(user.emailAddress);
    expect(ml.logs.length).toEqual(1);

    const emailQuery = buildQuery({
      ...FakeUser.loaderOptions(),
      clause: clause.In("email_address", user.emailAddress),
    });

    expect(ml.logs.length).toBe(1);

    // confirm email query  seen
    expect(ml.logs[0]).toStrictEqual({
      query: emailQuery,
      values: [user.emailAddress],
    });
  });
}

async function verifyMultiIDsDataAvail(
  loaderFn: () => ObjectLoader<ID>,
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
  loaderFn: () => ObjectLoader<ID>,
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
