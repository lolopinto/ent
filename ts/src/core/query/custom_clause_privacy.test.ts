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
  });
  if (mode === "source") {
    q.__maybeSetSource(user);
  }
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

test("a count cannot authorize a query subsequently bound to another source", async () => {
  const apply = jest.fn(async (_v: Viewer, source?: Ent) =>
    source ? Deny() : Allow(),
  );
  class SourceQuery extends CustomClauseQuery<FakeUser, Viewer, FakeUser> {
    getPrivacyPolicy() {
      return { rules: [{ apply }] };
    }
  }
  const q = new SourceQuery(user.viewer, {
    name: "source-users",
    clause: Eq("id", user.id),
    loadEntOptions: FakeUser.loaderOptions(),
  });
  const count = q.queryRawCount();
  // Binding is unsafe even while the original policy decision is in flight.
  expect(() => q.__maybeSetSource(user)).toThrow("cannot change source");
  expect(await count).toBe(1);
  const connection = new GraphQLEdgeConnection(user.viewer, user, () => q);
  await expect(connection.queryTotalCount()).rejects.toThrow(
    "cannot change source",
  );
  expect(apply).toHaveBeenCalledTimes(1);
});

test("an evaluated query can retain its original source", async () => {
  const q = new CustomClauseQuery<FakeUser, Viewer, FakeUser>(user.viewer, {
    name: "same-source-users",
    clause: Eq("id", user.id),
    loadEntOptions: FakeUser.loaderOptions(),
  });
  q.__maybeSetSource(user);
  expect(await q.queryRawCount()).toBe(1);
  const connection = new GraphQLEdgeConnection(user.viewer, user, () => q);
  expect(await connection.queryTotalCount()).toBe(1);
});

test("a policy query cannot be served for a source it was not built for", async () => {
  const other = await createTestUser();
  const apply = jest.fn(async () => Allow());
  class SourceQuery extends CustomClauseQuery<FakeUser, Viewer, FakeUser> {
    getPrivacyPolicy() {
      return { rules: [{ apply }] };
    }
  }
  const q = new SourceQuery(user.viewer, {
    name: "bound-users",
    clause: Eq("id", user.id),
    loadEntOptions: FakeUser.loaderOptions(),
  });
  q.__maybeSetSource(other);
  const connection = new GraphQLEdgeConnection(user.viewer, user, () => q);
  await expect(connection.queryTotalCount()).rejects.toThrow(
    "cannot change source",
  );
  expect(apply).not.toHaveBeenCalled();
});

test("connections cannot share a source-dependent allow decision before privacy starts", async () => {
  const other = await createTestUser();
  const apply = jest.fn(async (_viewer: Viewer, source?: Ent) =>
    source?.id === user.id ? Allow() : Deny(),
  );
  class SourceQuery extends CustomClauseQuery<FakeUser, Viewer, FakeUser> {
    getPrivacyPolicy() {
      return { rules: [{ apply }] };
    }
  }
  const makeQuery = () =>
    new SourceQuery(user.viewer, {
      name: "shared-source-users",
      clause: Eq("id", user.id),
      loadEntOptions: FakeUser.loaderOptions(),
    });
  const separate = new GraphQLEdgeConnection(user.viewer, other, makeQuery);
  expect(await separate.queryTotalCount()).toBe(0);
  apply.mockClear();

  const shared = makeQuery();
  const allowed = new GraphQLEdgeConnection(user.viewer, user, () => shared);
  const denied = new GraphQLEdgeConnection(user.viewer, other, () => shared);
  const results = await Promise.allSettled([
    allowed.queryTotalCount(),
    denied.queryTotalCount(),
  ]);
  expect(results[0]).toEqual({ status: "fulfilled", value: 1 });
  expect(results[1]).toMatchObject({
    status: "rejected",
    reason: new Error(
      "cannot change source of a custom query with a privacy policy; create a new query per source",
    ),
  });
  expect(apply).toHaveBeenCalledTimes(1);
  expect(apply).toHaveBeenCalledWith(user.viewer, user);
});

test("an evaluated policy query accepts another instance of its source", async () => {
  class SourceQuery extends CustomClauseQuery<FakeUser, Viewer, FakeUser> {
    getPrivacyPolicy() {
      return { rules: [{ apply: async () => Allow() }] };
    }
  }
  const q = new SourceQuery(user.viewer, {
    name: "reloaded-source-users",
    clause: Eq("id", user.id),
    loadEntOptions: FakeUser.loaderOptions(),
  });
  q.__maybeSetSource(user);
  expect(await q.queryRawCount()).toBe(1);
  const reloaded = new FakeUser(user.viewer, user.data);
  expect(reloaded).not.toBe(user);
  const connection = new GraphQLEdgeConnection(user.viewer, reloaded, () => q);
  expect(await connection.queryTotalCount()).toBe(1);
});

test("a query without a policy can be counted and then bound", async () => {
  const q = new CustomClauseQuery<FakeUser, Viewer, FakeUser>(user.viewer, {
    name: "unprotected-users",
    clause: Eq("id", user.id),
    loadEntOptions: FakeUser.loaderOptions(),
  });
  const getPolicy = jest.spyOn(q, "getPrivacyPolicy");
  expect(await q.queryRawCount()).toBe(1);
  const connection = new GraphQLEdgeConnection(user.viewer, user, () => q, {
    first: 1,
  });
  expect(await connection.queryTotalCount()).toBe(1);
  expect(await connection.queryEdges()).toHaveLength(1);
  expect(getPolicy).toHaveBeenCalled();
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
    expect(() => q.__maybeSetSource(user)).toThrow("cannot change source");
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
