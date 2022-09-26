import { MockLogs } from "../../testutils/mock_log";
import { TempDB } from "../../testutils/db/temp_db";
import { setLogLevels } from "../logger";
import {
  createTestUser,
  setupTempDB,
} from "../../testutils/fake_data/test_helpers";
import {
  createTag,
  FakeTag,
  FakeUser,
  UserToTagsFkeyQuery,
  UserToTagsFkeyQueryAsc,
} from "../../testutils/fake_data";
import { Viewer } from "../base";
import { buildQuery, DefaultLimit } from "../ent";
import { AndOptional, Eq, Greater, Less } from "../clause";
import { EdgeQuery } from "./query";

let tdb: TempDB;
let ml = new MockLogs();
let user: FakeUser;

beforeAll(async () => {
  setLogLevels(["query", "error", "cache"]);
  ml.mock();

  tdb = await setupTempDB();

  user = await createTestUser();
  await createTag(user.viewer, {
    displayName: "SPORTS",
    canonicalName: "sports",
    ownerID: user.id,
  });
  await createTag(user.viewer, {
    displayName: "kids",
    canonicalName: "kids",
    ownerID: user.id,
  });
  await createTag(user.viewer, {
    displayName: "work",
    canonicalName: "work",
    ownerID: user.id,
  });
  await createTag(user.viewer, {
    displayName: "FUN",
    canonicalName: "fun",
    ownerID: user.id,
  });
  await createTag(user.viewer, {
    displayName: "SoCCer",
    canonicalName: "soccer",
    ownerID: user.id,
  });
});

const COUNT = 5;

const getDescQuery = (viewer?: Viewer) => {
  return new UserToTagsFkeyQuery(viewer || user.viewer, user.id);
};

const getAscQuery = (viewer?: Viewer) => {
  return new UserToTagsFkeyQueryAsc(viewer || user.viewer, user.id);
};

beforeEach(() => {
  ml.clear();
});

afterAll(async () => {
  ml.restore();
  await tdb.afterAll();
});

function tests(
  getQuery: (v?: Viewer) => EdgeQuery<any, any, any>,
  dir: "ASC" | "DESC",
) {
  function verifyQuery(opts?: {
    limit: number;
    canonicalName?: string;
    last?: boolean;
  }) {
    const limit = opts?.limit || DefaultLimit;
    const canonicalName = opts?.canonicalName;
    let orderby = dir;
    let fn = dir === "DESC" ? Less : Greater;
    if (opts?.last) {
      orderby = dir === "ASC" ? "DESC" : "ASC";
      fn = dir === "DESC" ? Greater : Less;
    }
    expect(ml.logs.length).toBe(2);
    // console.debug(ml.logs, orderby, fn, opts);
    expect(ml.logs[1]).toStrictEqual({
      query: buildQuery({
        tableName: FakeTag.loaderOptions().tableName,
        fields: FakeTag.loaderOptions().fields,
        clause: AndOptional(
          Eq("owner_id", user.id),
          canonicalName ? fn("canonical_name", canonicalName) : undefined,
        ),
        orderby: `canonical_name ${orderby}`,
        limit: limit + 1,
      }),
      values: [user.id, canonicalName].filter((v) => v !== undefined),
    });
  }

  test("rawCount", async () => {
    const q = getQuery();

    const count = await q.queryRawCount();
    expect(count).toBe(COUNT);

    expect(ml.logs.length).toBe(2);
    expect(ml.logs[1]).toStrictEqual({
      query: buildQuery({
        tableName: FakeTag.loaderOptions().tableName,
        fields: ["count(1) as count"],
        clause: Eq("owner_id", user.id),
      }),
      values: [user.id],
    });
  });

  test("count", async () => {
    const q = getQuery();

    const count = await q.queryCount();
    expect(count).toBe(COUNT);
    verifyQuery();
  });

  test("edges", async () => {
    const q = getQuery();

    const edges = await q.queryEdges();
    expect(edges.length).toBe(COUNT);
    verifyQuery();
  });

  test("ents", async () => {
    const q = getQuery();

    const ents = await q.queryEnts();
    expect(ents.length).toBe(COUNT);
    verifyQuery();
  });

  test("ids", async () => {
    const q = getQuery();

    const ids = await q.queryIDs();
    expect(ids.length).toBe(COUNT);
    verifyQuery();
  });

  test("first N. after", async () => {
    const q = getQuery();
    const edges = await q.queryEdges();
    expect(edges.length).toBe(COUNT);
    const names = edges.map((edge) => edge.canonical_name);
    // console.debug(names);
    ml.clear();

    const q2 = getQuery();
    const edges2 = await q2.first(2).queryEdges();
    expect(edges2.length).toBe(2);
    verifyQuery({ limit: 2 });
    const cursor = q2.getCursor(edges2[1]);
    // console.debug(edges2);
    // console.debug("cursorrrs", cursor);
    ml.clear();

    const q3 = getQuery();
    const edges3 = await q3.first(2, cursor).queryEdges();
    expect(edges3.length).toBe(2);
    verifyQuery({ limit: 2, canonicalName: names[1] });
    expect(edges3[0].id).toBe(edges[2].id);
  });

  test("last N. before", async () => {
    const q = getQuery();
    const edges = await q.queryEdges();
    expect(edges.length).toBe(COUNT);
    const names = edges.map((edge) => edge.canonical_name).reverse();
    ml.clear();

    const q2 = getQuery();
    const edges2 = await q2.last(2).queryEdges();
    expect(edges2.length).toBe(2);
    verifyQuery({ limit: 2, last: true });
    const cursor = q2.getCursor(edges2[1]);
    ml.clear();

    const q3 = getQuery();
    const edges3 = await q3.last(2, cursor).queryEdges();
    expect(edges3.length).toBe(2);
    verifyQuery({ limit: 2, canonicalName: names[1], last: true });
    expect(edges3[0].id).toBe(edges[2].id);
  });
}

describe("desc", () => {
  tests(getDescQuery, "DESC");
});

describe("asc", () => {
  tests(getAscQuery, "ASC");
});
