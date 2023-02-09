import { MockLogs } from "../../testutils/mock_log";
import {
  FakeEvent,
  FakeUser,
  UserToEventsInNextWeekQuery,
  EdgeType,
  FakeUserSchema,
  getNextWeekClause,
} from "../../testutils/fake_data";
import {
  addEdge,
  createAllEvents,
  createTestUser,
  setupTempDB,
} from "../../testutils/fake_data/test_helpers";
import { setLogLevels } from "../logger";
import { TempDB } from "../../testutils/db/temp_db";
import { buildQuery } from "../ent";
import * as clause from "../clause";
import { Viewer } from "../base";
import { CustomClauseQuery } from "./custom_clause_query";

const INTERVAL = 24 * 60 * 60 * 1000;

let user: FakeUser;
let user2: FakeUser;
let ml = new MockLogs();
let tdb: TempDB;
const infos: Info[] = [];

interface Info {
  user: FakeUser;
  user2: FakeUser;
  events: FakeEvent[];
}

async function createData(startTime: number) {
  const [user, events] = await createAllEvents({
    howMany: 10,
    interval: INTERVAL,
    startTime: startTime,
  });
  const user2 = await createTestUser();
  await addEdge(user, FakeUserSchema, EdgeType.UserToFriends, false);
  const i = {
    user,
    user2,
    events,
  };
  infos.push(i);
  return i;
}

beforeAll(async () => {
  setLogLevels(["query", "error", "cache"]);
  ml.mock();

  tdb = await setupTempDB();

  const startTime = new Date().getTime();
  ({ user, user2 } = await createData(startTime));

  // create with same startTimes to ensure there's conflicts
  await createData(startTime);
  await createData(startTime);
  await createData(startTime);
});

beforeEach(() => {
  ml.clear();
});

afterAll(async () => {
  ml.restore();
  await tdb.afterAll();
});

const getQuery = (viewer?: Viewer) => {
  // when this is user.id instead of user,
  return new UserToEventsInNextWeekQuery(viewer || user.viewer, user.id);
};

const getGlobalQuery = (viewer?: Viewer, opts?: any) => {
  return new CustomClauseQuery(viewer || user.viewer, {
    clause: getNextWeekClause(),
    loadEntOptions: FakeEvent.loaderOptions(),
    name: "global_events_in_next_week",
    sortColumn: "start_time",
    ...opts,
  });
};

// test just to confirm that simple entquery things work
describe("query for user", () => {
  test("rawCount", async () => {
    const q = getQuery();

    const count = await q.queryRawCount();
    expect(count).toBe(7);
  });

  test("ents", async () => {
    const q = getQuery();

    const ents = await q.queryEnts();
    expect(ents.length).toBe(7);
  });

  test("first N", async () => {
    const q = getQuery();

    const ents = await q.first(2).queryEnts();
    expect(ents.length).toBe(2);
  });

  test("ids", async () => {
    const q = getQuery();

    const ids = await q.queryIDs();
    expect(ids.length).toBe(7);
  });

  test("count", async () => {
    const q = getQuery();

    const count = await q.queryCount();
    expect(count).toBe(7);
  });

  test("edges", async () => {
    const q = getQuery();

    const edges = await q.queryEdges();
    expect(edges.length).toBe(7);
  });

  test("first N. after", async () => {
    const q = getQuery();

    const edges = await q.queryEdges();
    expect(edges.length).toBe(7);

    ml.clear();

    const cursor = q.getCursor(edges[2]);
    const q2 = getQuery();
    const ents = await q2.first(2, cursor).queryEnts();
    expect(ents.length).toBe(2);
    expect(ents[0].id).toBe(edges[3].id);

    const query = buildQuery({
      ...FakeEvent.loaderOptions(),
      orderby: "start_time DESC, id DESC",
      limit: 3,
      clause: clause.And(
        clause.Eq("user_id", user.id),
        clause.GreaterEq("start_time", 1),
        clause.LessEq("start_time", 2),
        // the cursor check
        clause.PaginationMultipleColsSubQuery(
          "start_time",
          "<",
          FakeEvent.loaderOptions().tableName,
          "id",
          4,
        ),
      ),
    });
    expect(query).toEqual(ml.logs[ml.logs.length - 1].query);
  });
});

// tests CustomEdgeQueryBase privacy implementation
describe("privacy. loaded by other user", () => {
  test("rawCount", async () => {
    const q = getQuery(user2.viewer);

    const count = await q.queryRawCount();
    expect(count).toBe(0);
  });

  test("ents", async () => {
    const q = getQuery(user2.viewer);

    const ents = await q.queryEnts();
    expect(ents.length).toBe(0);
  });

  test("first N", async () => {
    const q = getQuery(user2.viewer);

    const ents = await q.first(2).queryEnts();
    expect(ents.length).toBe(0);
  });

  test("first N. after", async () => {
    const q = getQuery(user2.viewer);

    const edges = await q.queryEdges();
    expect(edges.length).toBe(0);
  });

  test("ids", async () => {
    const q = getQuery(user2.viewer);

    const ids = await q.queryIDs();
    expect(ids.length).toBe(0);
  });

  test("count", async () => {
    const q = getQuery(user2.viewer);

    const count = await q.queryCount();
    expect(count).toBe(0);
  });

  test("edges", async () => {
    const q = getQuery(user2.viewer);

    const edges = await q.queryEdges();
    expect(edges.length).toBe(0);
  });
});

describe("global query", () => {
  test("rawCount", async () => {
    const q = getGlobalQuery();

    const count = await q.queryRawCount();
    expect(count).toBe(7 * infos.length);
  });

  test("ents", async () => {
    const q = getGlobalQuery();

    const ents = await q.queryEnts();
    expect(ents.length).toBe(7 * infos.length);
  });

  test("first N", async () => {
    const q = getGlobalQuery();

    const ents = await q.first(2).queryEnts();
    expect(ents.length).toBe(2);
  });

  test("ids", async () => {
    const q = getGlobalQuery();

    const ids = await q.queryIDs();
    expect(ids.length).toBe(7 * infos.length);
  });

  test("count", async () => {
    const q = getGlobalQuery();

    const count = await q.queryCount();
    expect(count).toBe(7 * infos.length);
  });

  test("edges", async () => {
    const q = getGlobalQuery();

    const edges = await q.queryEdges();
    expect(edges.length).toBe(7 * infos.length);
  });

  test("first N. after each cursor", async () => {
    const q = getGlobalQuery();

    const edges = await q.queryEdges();
    expect(edges.length).toBe(7 * infos.length);

    ml.clear();
    const PAGE = 5;

    async function verify(
      idx: number,
      hasEdge: boolean,
      hasNextPage: boolean,
      cursor?: string,
    ) {
      const q2 = getGlobalQuery().first(PAGE, cursor);

      const ents = await q2.queryEnts();
      const newEdges = await q2.queryEdges();

      const query = buildQuery({
        ...FakeEvent.loaderOptions(),
        orderby: "start_time DESC, id DESC",
        limit: PAGE + 1,
        clause: clause.AndOptional(
          clause.GreaterEq("start_time", 1),
          clause.LessEq("start_time", 2),
          // the cursor check
          cursor
            ? clause.PaginationMultipleColsSubQuery(
                "start_time",
                "<",
                FakeEvent.loaderOptions().tableName,
                "id",
                4,
              )
            : undefined,
        ),
      });
      expect(query, idx.toString()).toEqual(ml.logs[ml.logs.length - 1].query);

      // 1 is a hack...
      const pagination = q2.paginationInfo().get(1);
      if (hasEdge) {
        expect(ents.length, idx.toString()).toBeGreaterThan(0);
        expect(ents.length, idx.toString()).toBeLessThanOrEqual(PAGE);
        // console.debug(page, ents[0].id, edges[PAGE * page]);
        expect(ents[0].id, idx.toString()).toBe(edges[idx].id);
      } else {
        expect(ents.length, idx.toString()).toBe(0);
        expect(newEdges.length, idx.toString()).toBe(0);
      }

      if (hasNextPage) {
        // has exact if next page
        expect(ents.length, idx.toString()).toBe(PAGE);

        expect(pagination?.hasNextPage, idx.toString()).toBe(true);
        expect(pagination?.hasPreviousPage, idx.toString()).toBe(false);
      } else {
        expect(pagination?.hasNextPage, idx.toString()).toBe(undefined);
        expect(pagination?.hasNextPage, idx.toString()).toBe(undefined);
      }
    }

    await verify(0, true, true); // 0-4
    await verify(1 * PAGE, true, true, q.getCursor(edges[PAGE - 1])); // 5-9
    await verify(2 * PAGE, true, true, q.getCursor(edges[2 * PAGE - 1])); // 10-14
    await verify(3 * PAGE, true, true, q.getCursor(edges[3 * PAGE - 1])); //15-19
    await verify(4 * PAGE, true, true, q.getCursor(edges[4 * PAGE - 1])); //20-24
    await verify(5 * PAGE, true, false, q.getCursor(edges[5 * PAGE - 1])); //25-28

    // do a few around transitions to make sure we handle it correctly
    // 0-4, 5-8, 9-12, 13-16 etc have duplicate timestamps
    await verify(1, true, true, q.getCursor(edges[0]));
    await verify(2, true, true, q.getCursor(edges[1]));
    await verify(3, true, true, q.getCursor(edges[2]));
    await verify(4, true, true, q.getCursor(edges[3]));

    await verify(8, true, true, q.getCursor(edges[7]));
    await verify(14, true, true, q.getCursor(edges[13]));
    await verify(19, true, true, q.getCursor(edges[18]));
  });

  test("first N. after each cursor. asc", async () => {
    const q = getGlobalQuery(user.viewer, { orderByDirection: "asc" });

    const edges = await q.queryEdges();
    expect(edges.length).toBe(7 * infos.length);

    ml.clear();
    const PAGE = 5;

    async function verify(
      idx: number,
      hasEdge: boolean,
      hasNextPage: boolean,
      cursor?: string,
    ) {
      const q2 = getGlobalQuery(user.viewer, { orderByDirection: "asc" }).first(
        PAGE,
        cursor,
      );

      const ents = await q2.queryEnts();
      const newEdges = await q2.queryEdges();

      const query = buildQuery({
        ...FakeEvent.loaderOptions(),
        orderby: "start_time ASC, id ASC",
        limit: PAGE + 1,
        clause: clause.AndOptional(
          clause.GreaterEq("start_time", 1),
          clause.LessEq("start_time", 2),
          // the cursor check
          cursor
            ? clause.PaginationMultipleColsSubQuery(
                "start_time",
                ">",
                FakeEvent.loaderOptions().tableName,
                "id",
                4,
              )
            : undefined,
        ),
      });
      expect(query, idx.toString()).toEqual(ml.logs[ml.logs.length - 1].query);

      // 1 is a hack...
      const pagination = q2.paginationInfo().get(1);
      if (hasEdge) {
        expect(ents.length, idx.toString()).toBeGreaterThan(0);
        expect(ents.length, idx.toString()).toBeLessThanOrEqual(PAGE);
        // console.debug(page, ents[0].id, edges[PAGE * page]);
        expect(ents[0].id, idx.toString()).toBe(edges[idx].id);
      } else {
        expect(ents.length, idx.toString()).toBe(0);
        expect(newEdges.length, idx.toString()).toBe(0);
      }

      if (hasNextPage) {
        // has exact if next page
        expect(ents.length, idx.toString()).toBe(PAGE);

        expect(pagination?.hasNextPage, idx.toString()).toBe(true);
        expect(pagination?.hasPreviousPage, idx.toString()).toBe(false);
      } else {
        expect(pagination?.hasNextPage, idx.toString()).toBe(undefined);
        expect(pagination?.hasNextPage, idx.toString()).toBe(undefined);
      }
    }

    await verify(0, true, true); // 0-4
    await verify(1 * PAGE, true, true, q.getCursor(edges[PAGE - 1])); // 5-9
    await verify(2 * PAGE, true, true, q.getCursor(edges[2 * PAGE - 1])); // 10-14
    await verify(3 * PAGE, true, true, q.getCursor(edges[3 * PAGE - 1])); //15-19
    await verify(4 * PAGE, true, true, q.getCursor(edges[4 * PAGE - 1])); //20-24
    await verify(5 * PAGE, true, false, q.getCursor(edges[5 * PAGE - 1])); //25-28

    // do a few around transitions to make sure we handle it correctly
    // 0-4, 5-8, 9-12, 13-16 etc have duplicate timestamps
    await verify(1, true, true, q.getCursor(edges[0]));
    await verify(2, true, true, q.getCursor(edges[1]));
    await verify(3, true, true, q.getCursor(edges[2]));
    await verify(4, true, true, q.getCursor(edges[3]));

    await verify(8, true, true, q.getCursor(edges[7]));
    await verify(14, true, true, q.getCursor(edges[13]));
    await verify(19, true, true, q.getCursor(edges[18]));
  });

  test("first N. after each cursor. asc + desc compared", async () => {
    const q = getGlobalQuery(user.viewer);
    const q2 = getGlobalQuery(user.viewer, { orderByDirection: "asc" });

    const edges = await q.queryEdges();
    expect(edges.length).toBe(7 * infos.length);

    const edges2 = await q2.queryEdges();
    expect(edges2.length).toBe(edges.length);
    expect(edges.reverse()).toStrictEqual(edges2);
  });
});
