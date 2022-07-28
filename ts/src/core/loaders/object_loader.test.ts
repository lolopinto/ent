import { ObjectLoader, ObjectLoaderFactory } from "./object_loader";
import { Pool } from "pg";
import { QueryRecorder } from "../../testutils/db_mock";

import {
  createRowForTest,
  deleteRowsForTest,
  editRowForTest,
} from "../../testutils/write";
import { TestContext } from "../../testutils/context/test_context";
import { setLogLevels } from "../logger";
import { MockLogs } from "../../testutils/mock_log";
import { Data, ID } from "../base";
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
import {
  integer,
  setupSqlite,
  table,
  text,
  timestamp,
} from "../../testutils/db/temp_db";
import DB, { Dialect } from "../db";
import { advanceTo } from "jest-date-mock";
import { convertDate } from "../convert";

jest.mock("pg");
QueryRecorder.mockPool(Pool);

const ml = new MockLogs();

const getNewLoader = (context: boolean | TestContext = true) => {
  return new ObjectLoaderFactory({
    tableName: "users",
    fields: ["id", "first_name"],
    key: "id",
  }).createLoader(
    context
      ? typeof context === "boolean"
        ? new TestContext()
        : context
      : undefined,
  );
};

const getNewLoaderWithCustomClause = (
  context: boolean | TestContext = true,
) => {
  return new ObjectLoaderFactory({
    tableName: "users",
    fields: ["id", "first_name", "deleted_at"],
    key: "id",
    clause: clause.Eq("deleted_at", null),
  }).createLoader(
    context
      ? typeof context === "boolean"
        ? new TestContext()
        : context
      : undefined,
  );
};

const getNewLoaderWithCustomClauseFunc = (
  context: boolean | TestContext = true,
) => {
  return new ObjectLoaderFactory({
    tableName: "users",
    fields: ["id", "first_name", "deleted_at"],
    key: "id",
    clause: () => clause.Eq("deleted_at", null),
    instanceKey: "users:transformedReadClause",
  }).createLoader(
    context
      ? typeof context === "boolean"
        ? new TestContext()
        : context
      : undefined,
  );
};

// deleted_at field but no custom_clause
// behavior when we're ignoring deleted_at. exception...
const getNewLoaderWithDeletedAtField = (context: boolean = true) => {
  return new ObjectLoader(
    {
      tableName: "users",
      fields: ["id", "first_name", "deleted_at"],
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

async function createWithNullDeletedAt(id?: ID) {
  await createRowForTest({
    tableName: "users",
    fields: {
      id: id || 1,
      first_name: "Jon",
      deleted_at: null,
    },
  });

  // clear post insert
  ml.clear();
}

async function createWithDeletedAt(id?: ID) {
  await createRowForTest({
    tableName: "users",
    fields: {
      id: id || 1,
      first_name: "Jon",
      deleted_at: new Date(),
    },
  });

  // clear post insert
  ml.clear();
}

describe("postgres", () => {
  beforeAll(async () => {
    setLogLevels(["query", "cache"]);
    ml.mock();

    await createEdges();
  });

  beforeEach(() => {
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
      table(
        "users",
        integer("id", { primaryKey: true }),
        text("first_name"),
        timestamp("deleted_at", { nullable: true }),
      ),
    );
    return tables;
  };
  setupSqlite(`sqlite:///object_loader.db`, tables);

  beforeAll(async () => {
    setLogLevels(["query", "error", "cache"]);
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

function filterNullIfSqlite(values: any[]) {
  if (DB.getDialect() === Dialect.SQLite) {
    return values.filter((f) => f !== null);
  }
  return values;
}

function transformDeletedAt(row: Data | null) {
  if (row === null) {
    return null;
  }
  if (row.deleted_at === null || row.deleted_at === undefined) {
    return row;
  }
  row.deleted_at = convertDate(row.deleted_at);
  return row;
}

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

  async function testWithCustomClause(getLoader: () => ObjectLoader<unknown>) {
    await createWithNullDeletedAt();
    const loader = getLoader();

    const row = await loader.load(1);
    expect(row).toEqual({
      id: 1,
      first_name: "Jon",
      deleted_at: null,
    });
    const row2 = await loader.load(1);
    expect(row).toBe(row2);
  }

  test("with context custom clause. cache hit", async () => {
    await testWithCustomClause(getNewLoaderWithCustomClause);
  });

  test("with context custom clause function. cache hit", async () => {
    await testWithCustomClause(getNewLoaderWithCustomClauseFunc);
  });

  async function testWithCustomClauseDeletedAt(
    getLoader: () => ObjectLoader<unknown>,
  ) {
    await createWithDeletedAt();
    const loader = getLoader();

    const row = await loader.load(1);
    expect(row).toEqual(null);
    const row2 = await loader.load(1);
    expect(row2).toBe(null);
  }

  test("with context. deleted at set. cache hit. normal query", async () => {
    await testWithCustomClauseDeletedAt(getNewLoaderWithCustomClause);
  });

  test("with context. deleted at set. function. cache hit. normal query", async () => {
    await testWithCustomClauseDeletedAt(getNewLoaderWithCustomClauseFunc);
  });

  test("with context. deleted at set. cache hit. bypass transform", async () => {
    const d = new Date();
    advanceTo(d);
    await createWithDeletedAt();
    const loader = getNewLoaderWithDeletedAtField();

    const row = await loader.load(1);
    expect(transformDeletedAt(row)).toEqual({
      id: 1,
      first_name: "Jon",
      deleted_at: d,
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

  async function testWithCustomClauseCacheMiss(
    getLoader: () => ObjectLoader<unknown>,
  ) {
    const loader = getLoader();

    const expQuery = buildQuery({
      tableName: "users",
      fields: ["id", "first_name", "deleted_at"],
      clause: clause.And(clause.Eq("deleted_at", null), clause.In("id", 1)),
    });
    const row = await loader.load(1);

    expect(row).toBe(null);
    expect(ml.logs.length).toBe(1);
    expect(ml.logs[0]).toStrictEqual({
      query: expQuery,
      values: filterNullIfSqlite([null, 1]),
    });

    const row2 = await loader.load(1);
    expect(row2).toBe(null);
    expect(ml.logs.length).toBe(2);
    expect(ml.logs[1]).toStrictEqual({
      "dataloader-cache-hit": 1,
      "tableName": "users",
    });
  }

  test("with context. custom clause. cache miss", async () => {
    await testWithCustomClauseCacheMiss(getNewLoaderWithCustomClause);
  });

  test("with context. custom clause func. cache miss", async () => {
    await testWithCustomClauseCacheMiss(getNewLoaderWithCustomClauseFunc);
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

  async function testWithoutContextCustomClauseCacheHit(
    getLoader: (context?: boolean) => ObjectLoader<unknown>,
  ) {
    await createWithNullDeletedAt();

    const loader = getLoader(false);

    const row = await loader.load(1);
    expect(row).toEqual({
      id: 1,
      first_name: "Jon",
      deleted_at: null,
    });

    const expQuery = buildQuery({
      tableName: "users",
      fields: ["id", "first_name", "deleted_at"],
      clause: clause.And(clause.Eq("deleted_at", null), clause.Eq("id", 1)),
    });
    expect(ml.logs.length).toBe(1);
    expect(ml.logs[0]).toStrictEqual({
      query: expQuery,
      values: filterNullIfSqlite([null, 1]),
    });

    // same data loaded  but not same row
    const row2 = await loader.load(1);

    expect(row).toStrictEqual(row2);
    expect(row).not.toBe(row2);

    // new query was made
    expect(ml.logs.length).toBe(2);
    expect(ml.logs[1]).toStrictEqual({
      query: expQuery,
      values: filterNullIfSqlite([null, 1]),
    });
  }

  test("without context. custom clause. cache hit", async () => {
    await testWithoutContextCustomClauseCacheHit(getNewLoaderWithCustomClause);
  });

  test("without context. custom clause func. cache hit", async () => {
    await testWithoutContextCustomClauseCacheHit(
      getNewLoaderWithCustomClauseFunc,
    );
  });

  async function withoutContextDeletedAtCacheHit(
    getLoader: (context?: boolean) => ObjectLoader<unknown>,
  ) {
    await createWithDeletedAt();

    const loader = getLoader(false);

    const row = await loader.load(1);
    expect(row).toBe(null);

    const expQuery = buildQuery({
      tableName: "users",
      fields: ["id", "first_name", "deleted_at"],
      clause: clause.And(clause.Eq("deleted_at", null), clause.Eq("id", 1)),
    });
    expect(ml.logs.length).toBe(1);
    expect(ml.logs[0]).toStrictEqual({
      query: expQuery,
      values: filterNullIfSqlite([null, 1]),
    });

    // same data loaded  but not same row
    const row2 = await loader.load(1);

    expect(row).toBe(null);

    // new query was made
    expect(ml.logs.length).toBe(2);
    expect(ml.logs[1]).toStrictEqual({
      query: expQuery,
      values: filterNullIfSqlite([null, 1]),
    });
  }

  test("without context. deleted_at set. cache hit. normal query", async () => {
    await withoutContextDeletedAtCacheHit(getNewLoaderWithCustomClause);
  });

  test("without context. deleted_at set. custom clause func. cache hit. normal query", async () => {
    await withoutContextDeletedAtCacheHit(getNewLoaderWithCustomClauseFunc);
  });

  test("without context. deleted_at set. cache hit. bypass transform", async () => {
    const d = new Date();
    advanceTo(d);
    await createWithDeletedAt();

    const loader = getNewLoaderWithDeletedAtField(false);

    const row = await loader.load(1);
    expect(transformDeletedAt(row)).toEqual({
      id: 1,
      first_name: "Jon",
      deleted_at: d,
    });

    const expQuery = buildQuery({
      tableName: "users",
      fields: ["id", "first_name", "deleted_at"],
      clause: clause.Eq("id", 1),
    });
    expect(ml.logs.length).toBe(1);
    expect(ml.logs[0]).toStrictEqual({
      query: expQuery,
      values: [1],
    });

    // same data loaded  but not same row
    const row2 = await loader.load(1);

    expect(transformDeletedAt(row)).toStrictEqual(transformDeletedAt(row2));
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

  async function testWithoutContextCustomClauseCacheMiss(
    getLoader: (context?: boolean) => ObjectLoader<unknown>,
  ) {
    const loader = getLoader(false);

    const row = await loader.load(1);
    expect(row).toBeNull();

    const expQuery = buildQuery({
      tableName: "users",
      fields: ["id", "first_name", "deleted_at"],
      clause: clause.And(clause.Eq("deleted_at", null), clause.Eq("id", 1)),
    });
    expect(ml.logs.length).toBe(1);
    expect(ml.logs[0]).toStrictEqual({
      query: expQuery,
      values: filterNullIfSqlite([null, 1]),
    });

    // same data loaded  but not same row
    const row2 = await loader.load(1);

    expect(row2).toBeNull();

    // new query was made
    expect(ml.logs.length).toBe(2);
    expect(ml.logs[1]).toStrictEqual({
      query: expQuery,
      values: filterNullIfSqlite([null, 1]),
    });
  }

  test("without context. custom clause. cache miss", async () => {
    await testWithoutContextCustomClauseCacheMiss(getNewLoaderWithCustomClause);
  });

  test("without context. custom clause func. cache miss", async () => {
    await testWithoutContextCustomClauseCacheMiss(
      getNewLoaderWithCustomClauseFunc,
    );
  });

  test("multi-ids. with context", async () => {
    await verifyMultiIDsDataAvail(
      getNewLoader,
      verifyMultiIDsGroupQuery,
      verifyMultiIDsCacheHit,
    );
  });

  test("multi-ids custom clause. with context", async () => {
    await verifyMultiIDsDataAvail(
      getNewLoaderWithCustomClause,
      verifyMultiIDsCustomClauseGroupQuery,
      verifyMultiIDsCacheHit,
      createWithNullDeletedAt,
    );
  });

  test("multi-ids custom clause func. with context", async () => {
    await verifyMultiIDsDataAvail(
      getNewLoaderWithCustomClauseFunc,
      verifyMultiIDsCustomClauseGroupQuery,
      verifyMultiIDsCacheHit,
      createWithNullDeletedAt,
    );
  });

  test("multi-ids. without context", async () => {
    await verifyMultiIDsDataAvail(
      () => getNewLoader(false),
      verifyMultiIDsGroupQueryMiss,
      verifyMultiIDsGroupQueryMiss,
    );
  });

  test("multi-ids custom clause. without context", async () => {
    await verifyMultiIDsDataAvail(
      () => getNewLoaderWithCustomClause(false),
      verifyMultiIDsCustomClauseGroupQueryMiss,
      verifyMultiIDsCustomClauseGroupQueryMiss,
      createWithNullDeletedAt,
    );
  });

  test("multi-ids custom clause func. without context", async () => {
    await verifyMultiIDsDataAvail(
      () => getNewLoaderWithCustomClauseFunc(false),
      verifyMultiIDsCustomClauseGroupQueryMiss,
      verifyMultiIDsCustomClauseGroupQueryMiss,
      createWithNullDeletedAt,
    );
  });

  test("multi-ids.no data. with context", async () => {
    await verifyMultiIDsNoDataAvail(
      getNewLoader,
      verifyMultiIDsGroupQuery,
      verifyMultiIDsCacheHit,
    );
  });

  test("multi-ids. no data custom clause. with context", async () => {
    await verifyMultiIDsNoDataAvail(
      getNewLoaderWithCustomClause,
      verifyMultiIDsCustomClauseGroupQuery,
      verifyMultiIDsCacheHit,
    );
  });

  test("multi-ids. no data custom clause func. with context", async () => {
    await verifyMultiIDsNoDataAvail(
      getNewLoaderWithCustomClauseFunc,
      verifyMultiIDsCustomClauseGroupQuery,
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

  test("multi-ids. no data custom clause. without context", async () => {
    await verifyMultiIDsNoDataAvail(
      () => getNewLoaderWithCustomClause(false),
      verifyMultiIDsCustomClauseGroupQueryMiss,
      verifyMultiIDsCustomClauseGroupQueryMiss,
    );
  });

  test("multi-ids. no data custom clause func. without context", async () => {
    await verifyMultiIDsNoDataAvail(
      () => getNewLoaderWithCustomClauseFunc(false),
      verifyMultiIDsCustomClauseGroupQueryMiss,
      verifyMultiIDsCustomClauseGroupQueryMiss,
    );
  });

  test("different loaders with clause, custom clause, custom clause with func. cache hit", async () => {
    await createWithNullDeletedAt();
    const ctx = new TestContext();
    const loader = getNewLoader(ctx);

    const row = await loader.load(1);
    expect(row).toEqual({
      id: 1,
      first_name: "Jon",
    });

    const customLoader = getNewLoaderWithCustomClause(ctx);
    const row2 = await customLoader.load(1);
    expect(row2).toEqual({
      id: 1,
      first_name: "Jon",
      deleted_at: null,
    });

    const customLoaderFunc = getNewLoaderWithCustomClauseFunc(ctx);
    const row3 = await customLoaderFunc.load(1);
    expect(row3).toEqual({
      id: 1,
      first_name: "Jon",
      deleted_at: null,
    });

    await editRowForTest({
      tableName: "users",
      whereClause: clause.Eq("id", 1),
      fields: {
        deleted_at: new Date(),
      },
    });

    ctx.cache.clearCache();
    const rowPostDelete = await loader.load(1);
    expect(rowPostDelete).toEqual({ id: 1, first_name: "Jon" });

    const row2PostDelete = await customLoader.load(1);
    expect(row2PostDelete).toBe(null);

    const row3PostDelete = await customLoaderFunc.load(1);
    expect(row3PostDelete).toBe(null);
  });

  // custom clause check?
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
  createFn?: (id?: ID) => Promise<void> | undefined,
) {
  if (createFn === undefined) {
    createFn = create;
  }
  const ids = [1, 2, 3, 4, 5];
  await Promise.all(ids.map((id) => createFn!(id)));
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

function verifyMultiIDsCustomClauseGroupQuery(ids: ID[]) {
  const expQuery = buildQuery({
    tableName: "users",
    fields: ["id", "first_name", "deleted_at"],
    clause: clause.And(clause.Eq("deleted_at", null), clause.In("id", ...ids)),
  });

  expect(ml.logs.length).toBe(1);
  expect(ml.logs[0]).toStrictEqual({
    query: expQuery,
    values: filterNullIfSqlite([null, ...ids]),
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

function verifyMultiIDsCustomClauseGroupQueryMiss(ids: ID[]) {
  expect(ml.logs.length).toBe(ids.length);
  ml.logs.forEach((log, idx) => {
    const expQuery = buildQuery({
      tableName: "users",
      fields: ["id", "first_name", "deleted_at"],
      clause: clause.And(
        clause.Eq("deleted_at", null),
        clause.Eq("id", ids[idx]),
      ),
    });
    expect(log).toStrictEqual({
      query: expQuery,
      values: filterNullIfSqlite([null, ids[idx]]),
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
