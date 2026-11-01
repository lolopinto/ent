import { GraphQLEdgeConnection } from "../../graphql/query/edge_connection";
import { TempDB } from "../../testutils/db/temp_db";
import { FakeUser } from "../../testutils/fake_data";
import {
  createTestUser,
  setupTempDB,
} from "../../testutils/fake_data/test_helpers";
import { Allow, Deny, Ent, Viewer } from "../base";
import { Eq } from "../clause";
import DB from "../db";
import { CustomClauseQuery } from "./custom_clause_query";

let db: TempDB;
let user: FakeUser;
beforeAll(async () => {
  db = await setupTempDB();
  user = await createTestUser();
});
afterAll(async () => db.afterAll());

test.each([
  "global",
  "source",
  "connection",
])("denied %s custom query protects all result and count paths", async (mode) => {
  const apply = jest.fn(async (_v: Viewer, source?: Ent) => {
    expect(source).toBe(mode === "global" ? undefined : user);
    return Deny();
  });
  class DeniedQuery extends CustomClauseQuery<FakeUser, Viewer, FakeUser> {
    getPrivacyPolicy() {
      return { rules: [{ apply }] };
    }
  }
  const q = new DeniedQuery(user.viewer, {
    name: "denied-users",
    clause: Eq("id", user.id),
    loadEntOptions: FakeUser.loaderOptions(),
    source: mode === "global" ? undefined : user,
  });
  const connection =
    mode === "connection"
      ? new GraphQLEdgeConnection(user.viewer, user, () => q, { first: 1 })
      : new GraphQLEdgeConnection(user.viewer, () => q, { first: 1 });
  const query = jest.spyOn(DB.getInstance().getPool(), "query");
  try {
    expect(await connection.queryTotalCount()).toBe(0);
    expect(await q.queryRawCount()).toBe(0);
    expect(await q.queryIDs()).toEqual([]);
    expect(await q.queryEdges()).toEqual([]);
    expect(await q.queryEnts()).toEqual([]);
    expect(await q.queryCount()).toBe(0);
    const key = mode === "global" ? 1 : user.id;
    expect(await q.queryAllIDs()).toEqual(new Map([[key, []]]));
    expect(await q.queryAllEdges()).toEqual(new Map([[key, []]]));
    expect(await q.queryAllEnts()).toEqual(new Map([[key, []]]));
    expect(await q.queryAllCount()).toEqual(new Map([[key, 0]]));
    expect(await connection.queryEdges()).toEqual([]);
    expect(await connection.queryPageInfo()).toMatchObject({
      hasNextPage: false,
      hasPreviousPage: false,
    });
    expect(apply).toHaveBeenCalledTimes(1);
    expect(query).not.toHaveBeenCalled();
  } finally {
    query.mockRestore();
  }
});

test("allowed custom query retains normal rows, counts and entity privacy", async () => {
  const apply = jest.fn(async () => Allow());
  class AllowedQuery extends CustomClauseQuery<FakeUser> {
    getPrivacyPolicy() {
      return { rules: [{ apply }] };
    }
  }
  const other = await createTestUser();
  const q = new AllowedQuery(other.viewer, {
    name: "allowed-users",
    clause: Eq("id", user.id),
    loadEntOptions: FakeUser.loaderOptions(),
  });
  expect(await q.queryRawCount()).toBe(1);
  expect(await q.queryIDs()).toEqual([user.id]);
  expect(await q.queryCount()).toBe(1);
  expect(await q.queryEnts()).toEqual([]);
  expect(apply).toHaveBeenCalledTimes(1);
});

test.each([
  true,
  false,
])("GraphQL parents do not become authorization sources (allow=%s)", async (allowed) => {
  const other = await createTestUser();
  const apply = jest.fn(async (_viewer: Viewer, source?: Ent) => {
    expect(source).toBeUndefined();
    return allowed ? Allow() : Deny();
  });
  class GlobalQuery extends CustomClauseQuery<FakeUser> {
    getPrivacyPolicy() {
      return { rules: [{ apply }] };
    }
  }
  const q = new GlobalQuery(user.viewer, {
    name: "global-under-parents",
    clause: Eq("id", user.id),
    loadEntOptions: FakeUser.loaderOptions(),
  });
  // Start authorization before either async connection factory resolves.
  const count = q.queryRawCount();
  const connections = [user, other].map(
    (parent) => new GraphQLEdgeConnection(user.viewer, parent, async () => q),
  );
  expect(
    await Promise.all([count, ...connections.map((c) => c.queryTotalCount())]),
  ).toEqual([allowed ? 1 : 0, allowed ? 1 : 0, allowed ? 1 : 0]);
  expect(apply).toHaveBeenCalledTimes(1);
});

test("explicit authorization source is independent of the GraphQL parent and options mutation", async () => {
  const other = await createTestUser();
  const apply = jest.fn(async (_viewer: Viewer, source?: Ent) => {
    expect(source).toBe(user);
    return Allow();
  });
  class SourceQuery extends CustomClauseQuery<FakeUser, Viewer, FakeUser> {
    getPrivacyPolicy() {
      return { rules: [{ apply }] };
    }
  }
  const options = {
    name: "explicit-source-users",
    clause: Eq("id", user.id),
    loadEntOptions: FakeUser.loaderOptions(),
    source: user,
  };
  const q = new SourceQuery(user.viewer, options);
  options.source = other;
  const connection = new GraphQLEdgeConnection(
    user.viewer,
    other,
    async () => q,
  );
  expect(await connection.queryTotalCount()).toBe(1);
  expect(await q.queryAllIDs()).toEqual(new Map([[user.id, [user.id]]]));
  expect(await q.sourceEnt(other.id)).toBe(user);
  expect(apply).toHaveBeenCalledTimes(1);
});

test("count, rows and page info share one query-policy decision", async () => {
  const apply = jest.fn(async () => Allow());
  class AllowedQuery extends CustomClauseQuery<FakeUser> {
    getPrivacyPolicy() {
      return { rules: [{ apply }] };
    }
  }
  const q = new AllowedQuery(user.viewer, {
    name: "concurrent-policy-users",
    clause: Eq("id", user.id),
    loadEntOptions: FakeUser.loaderOptions(),
  }).first(1);
  const [count, ids, page] = await Promise.all([
    q.queryRawCount(),
    q.queryIDs(),
    q.queryPageInfo(),
  ]);
  expect(count).toBe(1);
  expect(ids).toEqual([user.id]);
  expect(page.hasNextPage).toBe(false);
  expect(apply).toHaveBeenCalledTimes(1);
});

test("a failed privacy evaluation stays closed; retry with a new query", async () => {
  const failure = new Error("temporary policy failure");
  const apply = jest
    .fn()
    .mockRejectedValueOnce(failure)
    .mockResolvedValue(Allow());
  class SourceQuery extends CustomClauseQuery<FakeUser, Viewer, FakeUser> {
    getPrivacyPolicy() {
      return { rules: [{ apply }] };
    }
  }
  const makeQuery = () =>
    new SourceQuery(user.viewer, {
      name: "failed-policy-users",
      clause: Eq("id", user.id),
      loadEntOptions: FakeUser.loaderOptions(),
    });
  const q = makeQuery();
  const query = jest.spyOn(DB.getInstance().getPool(), "query");
  try {
    const results = await Promise.allSettled([
      q.queryRawCount(),
      q.queryEdges(),
    ]);
    expect(results).toEqual([
      { status: "rejected", reason: failure },
      { status: "rejected", reason: failure },
    ]);
    await expect(q.queryRawCount()).rejects.toBe(failure);
    await expect(q.queryEdges()).rejects.toBe(failure);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(query).not.toHaveBeenCalled();
  } finally {
    query.mockRestore();
  }
  expect(await makeQuery().queryRawCount()).toBe(1);
  expect(apply).toHaveBeenCalledTimes(2);
});

test("synchronous policy construction failures are shared by counts and rows", async () => {
  const failure = new Error("policy construction failed");
  const getPolicy = jest
    .fn()
    .mockImplementationOnce(() => {
      throw failure;
    })
    .mockReturnValue({ rules: [{ apply: async () => Deny() }] });
  class BrokenQuery extends CustomClauseQuery<FakeUser> {
    getPrivacyPolicy() {
      return getPolicy();
    }
  }
  const q = new BrokenQuery(user.viewer, {
    name: "broken-policy-users",
    clause: Eq("id", user.id),
    loadEntOptions: FakeUser.loaderOptions(),
  });
  await expect(q.queryRawCount()).rejects.toBe(failure);
  await expect(q.queryRawCount()).rejects.toBe(failure);
  await expect(q.queryEdges()).rejects.toBe(failure);
  await expect(q.queryPageInfo()).rejects.toBe(failure);
  expect(getPolicy).toHaveBeenCalledTimes(1);
});
