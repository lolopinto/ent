import { MockLogs } from "../../testutils/mock_log";
import {
  FakeEvent,
  FakeUser,
  UserToEventsInNextWeekQuery,
} from "../../testutils/fake_data";
import {
  createAllEvents,
  createTestUser,
  setupTempDB,
} from "../../testutils/fake_data/test_helpers";
import { setLogLevels } from "../logger";
import { TempDB } from "../../testutils/db/test_db";
import { buildQuery } from "../ent";
import * as clause from "../clause";
import { Viewer } from "../base";

const INTERVAL = 24 * 60 * 60 * 1000;

let user: FakeUser;
let user2: FakeUser;
let events: FakeEvent[];
let ml = new MockLogs();
let tdb: TempDB;

beforeAll(async () => {
  setLogLevels(["query", "error"]);
  ml.mock();

  tdb = await setupTempDB();
  [user, events] = await createAllEvents({
    howMany: 10,
    interval: INTERVAL,
  });
  user2 = await createTestUser();
});

beforeEach(() => {
  ml.clear();
});

afterAll(async () => {
  ml.restore();
  await tdb.afterAll();
});

const getQuery = (viewer?: Viewer) => {
  return new UserToEventsInNextWeekQuery(viewer || user.viewer, user);
};

// test just to confirm that simple entquery things work
test("rawCount", async () => {
  const q = getQuery();

  const count = await q.queryRawCount();
  expect(count).toBe(7);
  expect(ml.logs.length).toBe(1);
});

test("ents", async () => {
  const q = getQuery();

  const ents = await q.queryEnts();
  expect(ents.length).toBe(7);
  expect(ml.logs.length).toBe(1);
});

test("first N", async () => {
  const q = getQuery();

  const ents = await q.first(2).queryEnts();
  expect(ents.length).toBe(2);
  expect(ml.logs.length).toBe(1);
});

test("ids", async () => {
  const q = getQuery();

  const ids = await q.queryIDs();
  expect(ids.length).toBe(7);
  expect(ml.logs.length).toBe(1);
});

test("count", async () => {
  const q = getQuery();

  const count = await q.queryCount();
  expect(count).toBe(7);
  expect(ml.logs.length).toBe(1);
});

test("edges", async () => {
  const q = getQuery();

  const edges = await q.queryEdges();
  expect(edges.length).toBe(7);
  expect(ml.logs.length).toBe(1);
});

test("first N. after", async () => {
  const q = getQuery();

  const edges = await q.queryEdges();
  expect(edges.length).toBe(7);
  expect(ml.logs.length).toBe(1);

  ml.clear();

  const cursor = q.getCursor(edges[2]);
  const q2 = getQuery();
  const ents = await q2.first(2, cursor).queryEnts();
  expect(ents.length).toBe(2);
  expect(ents[0].id).toBe(edges[3].id);
  expect(ml.logs.length).toBe(1);

  const query = buildQuery({
    ...FakeEvent.loaderOptions(),
    orderby: "start_time DESC",
    limit: 3,
    clause: clause.And(
      clause.Eq("user_id", user.id),
      clause.GreaterEq("start_time", 1),
      clause.LessEq("start_time", 2),
      // the cursor check
      clause.Less("start_time", 4),
    ),
  });
  expect(query).toEqual(ml.logs[0].query);
});

// tests CustomEdgeQueryBase privacy implementation

describe("privacy. loaded by other user", () => {
  test("rawCount", async () => {
    const q = getQuery(user2.viewer);

    const count = await q.queryRawCount();
    expect(count).toBe(0);
    expect(ml.logs.length).toBe(0);
  });

  test("ents", async () => {
    const q = getQuery(user2.viewer);

    const ents = await q.queryEnts();
    expect(ents.length).toBe(0);
    expect(ml.logs.length).toBe(0);
  });

  test("first N", async () => {
    const q = getQuery(user2.viewer);

    const ents = await q.first(2).queryEnts();
    expect(ents.length).toBe(0);
    expect(ml.logs.length).toBe(0);
  });

  test("first N. after", async () => {
    const q = getQuery(user2.viewer);

    const edges = await q.queryEdges();
    expect(edges.length).toBe(0);
    expect(ml.logs.length).toBe(0);
  });

  test("ids", async () => {
    const q = getQuery(user2.viewer);

    const ids = await q.queryIDs();
    expect(ids.length).toBe(0);
    expect(ml.logs.length).toBe(0);
  });

  test("count", async () => {
    const q = getQuery(user2.viewer);

    const count = await q.queryCount();
    expect(count).toBe(0);
    expect(ml.logs.length).toBe(0);
  });

  test("edges", async () => {
    const q = getQuery(user2.viewer);

    const edges = await q.queryEdges();
    expect(edges.length).toBe(0);
    expect(ml.logs.length).toBe(0);
  });
});
