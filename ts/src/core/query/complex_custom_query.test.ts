import { v1 } from "uuid";
import { DateTime } from "luxon";
import { MockLogs } from "../../testutils/mock_log";
import {
  FakeEvent,
  FakeUser,
  UserToEventsInNextWeekQuery,
  EdgeType,
  FakeUserSchema,
  getNextWeekClause,
  FakeEventSchema,
  ViewerWithAccessToken,
} from "../../testutils/fake_data";
import {
  addEdge,
  createAllEvents,
  createTestUser,
  inputs,
  setupTempDB,
} from "../../testutils/fake_data/test_helpers";
import { setLogLevels } from "../logger";
import { TempDB, integer, table, text, uuid } from "../../testutils/db/temp_db";
import { buildQuery, reverseOrderBy } from "../query_impl";
import { loadCustomEnts } from "../ent";
import * as clause from "../clause";
import { Data, Ent, Viewer, WriteOperation } from "../base";
import { CustomClauseQuery } from "./custom_clause_query";
import { AnyEnt, SimpleBuilder } from "../../testutils/builder";
import { OrderByOption } from "../query_impl";
import { createRowForTest } from "../../testutils/write";
import { randomEmail } from "../../testutils/db/value";
import DB from "../db";
import { LoggedOutViewer } from "../viewer";
import { load } from "js-yaml";

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
  const { events } = await createData(startTime);
  await createData(startTime);
  await createData(startTime);

  // add some non-null endtimes.
  for await (const event of events) {
    const builder = new SimpleBuilder(
      event.viewer,
      FakeEventSchema,
      new Map([
        [
          "endTime",
          DateTime.fromJSDate(event.startTime).plus({ hours: 1 }).toJSDate(),
        ],
      ]),
      WriteOperation.Edit,
      event,
    );
    await builder.saveX();
    const evt = await builder.editedEntX();
    expect(evt.endTime).not.toBeNull();
    expect(evt.endTime).not.toBe(event.endTime);
  }
});

beforeEach(() => {
  ml.clear();
});

afterAll(async () => {
  ml.restore();
  await tdb.afterAll();
});

// this is testing deprecated sortColumn
const getQuery = (viewer?: Viewer) => {
  // when this is user.id instead of user,
  return new UserToEventsInNextWeekQuery(viewer || user.viewer, user.id);
};

const getGlobalQuery = (viewer?: Viewer, opts?: Partial<OrderByOption>) => {
  return new CustomClauseQuery<FakeEvent>(viewer || user.viewer, {
    clause: getNextWeekClause(),
    loadEntOptions: FakeEvent.loaderOptions(),
    name: "global_events_in_next_week",
    orderby: [
      {
        column: "start_time",
        direction: "DESC",
        dateColumn: true,
        ...opts,
      },
    ],
  });
};

// get creators of events (users) in next week
const getCreatorsOfGlobalEventsInNextWeek = (opts?: Partial<OrderByOption>) => {
  const loaderOptions = FakeUser.loaderOptions();
  const tableName = loaderOptions.tableName;
  loaderOptions.tableName = "fake_events";
  loaderOptions.alias = "e";
  loaderOptions.fieldsAlias = "u";

  const viewer = new ViewerWithAccessToken(user.id, {
    tokens: {
      always_allow_user: true,
    },
  });

  return new CustomClauseQuery<FakeUser>(viewer, {
    // can do the clause on the events table as long as it's aliased
    clause: getNextWeekClause(),
    loadEntOptions: loaderOptions,
    name: "global_creators_for_events_in_next_week",
    orderby: [
      {
        column: "created_at",
        direction: "DESC",
        dateColumn: true,
        ...opts,
      },
    ],
    joinBETA: [
      {
        tableName,
        alias: "u",
        clause: clause.Expression("u.id = e.user_id"),
      },
    ],
  });
};

const getEndTimeGlobalQuery = (
  viewer?: Viewer,
  opts?: Partial<OrderByOption>,
) => {
  return new CustomClauseQuery<FakeEvent>(viewer || user.viewer, {
    clause: getNextWeekClause(),
    loadEntOptions: FakeEvent.loaderOptions(),
    name: "global_events_in_next_week_end_time",
    orderby: [
      {
        column: "end_time",
        direction: "DESC",
        ...opts,
      },
    ],
  });
};

// just to test the behavior when cursorCol == sortCol
const getIdGlobalQuery = (viewer?: Viewer, opts?: Partial<OrderByOption>) => {
  return new CustomClauseQuery<FakeEvent>(viewer || user.viewer, {
    clause: getNextWeekClause(),
    loadEntOptions: FakeEvent.loaderOptions(),
    name: "global_events_in_next_week_id",
    orderby: [
      {
        column: "id",
        direction: "DESC",
        ...opts,
      },
    ],
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
      orderby: [
        {
          column: "start_time",
          direction: "DESC",
        },
        {
          column: "id",
          direction: "DESC",
        },
      ],
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

  test("first N. nulls first on non-nullable does nothing", async () => {
    const q = getGlobalQuery(user.viewer, {
      nullsPlacement: "first",
    });

    const ents = await q.first(2).queryEnts();
    expect(ents.length).toBe(2);
  });

  test("first N. nulls last on non-nullable does nothing", async () => {
    const q = getGlobalQuery(user.viewer, {
      nullsPlacement: "last",
    });

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
        orderby: [
          {
            column: "start_time",
            direction: "DESC",
          },
          {
            column: "id",
            direction: "DESC",
          },
        ],
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
    const q = getGlobalQuery(user.viewer, { direction: "ASC" });

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
      const q2 = getGlobalQuery(user.viewer, { direction: "ASC" }).first(
        PAGE,
        cursor,
      );

      const ents = await q2.queryEnts();
      const newEdges = await q2.queryEdges();

      const query = buildQuery({
        ...FakeEvent.loaderOptions(),
        orderby: [
          {
            column: "start_time",
            direction: "ASC",
          },
          {
            column: "id",
            direction: "ASC",
          },
        ],
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
    const q2 = getGlobalQuery(user.viewer, { direction: "ASC" });

    const edges = await q.queryEdges();
    expect(edges.length).toBe(7 * infos.length);

    const edges2 = await q2.queryEdges();
    expect(edges2.length).toBe(edges.length);
    expect(edges.reverse()).toStrictEqual(edges2);
  });
});

describe("global query - end time", () => {
  test("rawCount", async () => {
    const q = getEndTimeGlobalQuery();

    const count = await q.queryRawCount();
    expect(count).toBe(7 * infos.length);
  });

  test("ents", async () => {
    const q = getEndTimeGlobalQuery();

    const ents = await q.queryEnts();
    expect(ents.length).toBe(7 * infos.length);
  });

  test("first N", async () => {
    const q = getEndTimeGlobalQuery();

    const ents = await q.first(7).queryEnts();
    expect(ents.length).toBe(7);

    // we do 3 batches of createData() and we augment endTime to not be null for the first batch
    // postgres by default does null first so without specifying anything, these should all be nulls
    for (const event of ents) {
      expect(event.endTime).toBeNull();
    }
  });

  test("first N. nulls last", async () => {
    const q = getEndTimeGlobalQuery(user.viewer, {
      nullsPlacement: "last",
    });

    const ents = await q.first(7).queryEnts();
    expect(ents.length).toBe(7);

    // we do 3 batches of createData() and we augment endTime to not be null for the first batch
    // postgres by default does null first so without specifying anything, these should all be nulls
    for (const event of ents) {
      expect(event.endTime).not.toBeNull();
    }

    const query = buildQuery({
      ...FakeEvent.loaderOptions(),
      orderby: [
        {
          column: "end_time",
          direction: "DESC",
          nullsPlacement: "last",
        },
        {
          column: "id",
          direction: "DESC",
        },
      ],
      limit: 8,
      clause: clause.AndOptional(
        clause.GreaterEq("start_time", 1),
        clause.LessEq("start_time", 2),
      ),
    });
    expect(query).toEqual(ml.logs[0].query);
  });

  test("first N. asc", async () => {
    // ascending is by default nulls last in postgres
    const q = getEndTimeGlobalQuery(user.viewer, {
      direction: "ASC",
    });

    const ents = await q.first(7).queryEnts();
    expect(ents.length).toBe(7);

    for (const event of ents) {
      expect(event.endTime).not.toBeNull();
    }

    const query = buildQuery({
      ...FakeEvent.loaderOptions(),
      orderby: [
        {
          column: "end_time",
          direction: "ASC",
        },
        {
          column: "id",
          direction: "ASC",
        },
      ],
      limit: 8,
      clause: clause.AndOptional(
        clause.GreaterEq("start_time", 1),
        clause.LessEq("start_time", 2),
      ),
    });
    expect(query).toEqual(ml.logs[0].query);
  });

  test("first N. asc. nulls first", async () => {
    const q = getEndTimeGlobalQuery(user.viewer, {
      direction: "ASC",
      nullsPlacement: "first",
    });

    const ents = await q.first(7).queryEnts();
    expect(ents.length).toBe(7);

    for (const event of ents) {
      expect(event.endTime).toBeNull();
    }

    const query = buildQuery({
      ...FakeEvent.loaderOptions(),
      orderby: [
        {
          column: "end_time",
          direction: "ASC",
          nullsPlacement: "first",
        },
        {
          column: "id",
          direction: "ASC",
        },
      ],
      limit: 8,
      clause: clause.AndOptional(
        clause.GreaterEq("start_time", 1),
        clause.LessEq("start_time", 2),
      ),
    });
    expect(query).toEqual(ml.logs[0].query);
  });

  test("ids", async () => {
    const q = getEndTimeGlobalQuery();

    const ids = await q.queryIDs();
    expect(ids.length).toBe(7 * infos.length);
  });

  test("count", async () => {
    const q = getEndTimeGlobalQuery();

    const count = await q.queryCount();
    expect(count).toBe(7 * infos.length);
  });

  test("edges", async () => {
    const q = getEndTimeGlobalQuery();

    const edges = await q.queryEdges();
    expect(edges.length).toBe(7 * infos.length);
  });
});

describe("global query. id. cursor and sort_column the same", () => {
  test("rawCount", async () => {
    const q = getIdGlobalQuery();

    const count = await q.queryRawCount();
    expect(count).toBe(7 * infos.length);
  });

  test("ents", async () => {
    const q = getIdGlobalQuery();

    const ents = await q.queryEnts();
    expect(ents.length).toBe(7 * infos.length);
  });

  test("first N", async () => {
    const q = getIdGlobalQuery();

    const ents = await q.first(7).queryEnts();
    expect(ents.length).toBe(7);
  });

  test("first N. nulls last", async () => {
    const q = getIdGlobalQuery(user.viewer, {
      nullsPlacement: "last",
    });

    const ents = await q.first(7).queryEnts();
    expect(ents.length).toBe(7);

    const query = buildQuery({
      ...FakeEvent.loaderOptions(),
      orderby: [
        {
          column: "id",
          direction: "DESC",
          nullsPlacement: "last",
        },
      ],
      limit: 8,
      clause: clause.AndOptional(
        clause.GreaterEq("start_time", 1),
        clause.LessEq("start_time", 2),
      ),
    });
    expect(query).toEqual(ml.logs[0].query);
  });

  test("first N. asc", async () => {
    // ascending is by default nulls last in postgres
    const q = getIdGlobalQuery(user.viewer, {
      direction: "ASC",
    });

    const ents = await q.first(7).queryEnts();
    expect(ents.length).toBe(7);

    const query = buildQuery({
      ...FakeEvent.loaderOptions(),
      orderby: [
        {
          column: "id",
          direction: "ASC",
        },
      ],
      limit: 8,
      clause: clause.AndOptional(
        clause.GreaterEq("start_time", 1),
        clause.LessEq("start_time", 2),
      ),
    });
    expect(query).toEqual(ml.logs[0].query);
  });

  test("first N. asc. nulls first", async () => {
    const q = getIdGlobalQuery(user.viewer, {
      direction: "ASC",
      nullsPlacement: "first",
    });

    const ents = await q.first(7).queryEnts();
    expect(ents.length).toBe(7);

    const query = buildQuery({
      ...FakeEvent.loaderOptions(),
      orderby: [
        {
          column: "id",
          direction: "ASC",
          nullsPlacement: "first",
        },
      ],
      limit: 8,
      clause: clause.AndOptional(
        clause.GreaterEq("start_time", 1),
        clause.LessEq("start_time", 2),
      ),
    });
    expect(query).toEqual(ml.logs[0].query);
  });

  test("ids", async () => {
    const q = getIdGlobalQuery();

    const ids = await q.queryIDs();
    expect(ids.length).toBe(7 * infos.length);
  });

  test("count", async () => {
    const q = getIdGlobalQuery();

    const count = await q.queryCount();
    expect(count).toBe(7 * infos.length);
  });

  test("edges", async () => {
    const q = getIdGlobalQuery();

    const edges = await q.queryEdges();
    expect(edges.length).toBe(7 * infos.length);
  });
});

describe("global query - with joins", () => {
  // this only has 4 ids returned so not the best example which is
  // why we have what's below (joins - products)
  test("rawCount", async () => {
    const q = getCreatorsOfGlobalEventsInNextWeek();

    const count = await q.queryRawCount();
    expect(count).toBe(infos.length);
  });

  test("ents", async () => {
    const q = getCreatorsOfGlobalEventsInNextWeek();

    const ents = await q.queryEnts();
    expect(ents.length).toBe(infos.length);
  });

  test("first N", async () => {
    const q = getCreatorsOfGlobalEventsInNextWeek();

    const ents = await q.first(2).queryEnts();
    expect(ents.length).toBe(2);
  });

  test("first N. nulls first on non-nullable does nothing", async () => {
    const q = getCreatorsOfGlobalEventsInNextWeek({
      nullsPlacement: "first",
    });

    const ents = await q.first(2).queryEnts();
    expect(ents.length).toBe(2);
  });

  test("first N. nulls last on non-nullable does nothing", async () => {
    const q = getCreatorsOfGlobalEventsInNextWeek({
      nullsPlacement: "last",
    });

    const ents = await q.first(2).queryEnts();
    expect(ents.length).toBe(2);
  });

  test("ids", async () => {
    const q = getCreatorsOfGlobalEventsInNextWeek();

    const ids = await q.queryIDs();
    expect(ids.length).toBe(infos.length);
  });

  test("count", async () => {
    const q = getCreatorsOfGlobalEventsInNextWeek();

    const count = await q.queryCount();
    expect(count).toBe(infos.length);
  });

  test("edges", async () => {
    const q = getCreatorsOfGlobalEventsInNextWeek();

    const edges = await q.queryEdges();
    expect(edges.length).toBe(infos.length);
  });

  test("first N. after each cursor", async () => {
    const q = getCreatorsOfGlobalEventsInNextWeek();

    const edges = await q.queryEdges();
    expect(edges.length).toBe(infos.length);

    await paginateAndVerifyClauseWithJoin(
      getCreatorsOfGlobalEventsInNextWeek,
      edges,
    );
  });

  test("first N. after each cursor. asc", async () => {
    const q = getCreatorsOfGlobalEventsInNextWeek({
      direction: "ASC",
    });

    const edges = await q.queryEdges();
    expect(edges.length).toBe(infos.length);

    await paginateAndVerifyClauseWithJoin(
      () =>
        getCreatorsOfGlobalEventsInNextWeek({
          direction: "ASC",
        }),
      edges,
    );
  });

  test("first N. after each cursor. asc + desc compared", async () => {
    const q = getCreatorsOfGlobalEventsInNextWeek();
    const q2 = getCreatorsOfGlobalEventsInNextWeek({
      direction: "ASC",
    });

    const edges = await q.queryEdges();
    expect(edges.length).toBe(infos.length);

    const edges2 = await q2.queryEdges();
    expect(edges2.length).toBe(edges.length);
    expect(edges.reverse()).toStrictEqual(edges2);
  });
});

describe("joins - products", () => {
  const usersTable = table(
    "users",
    uuid("id", {
      primaryKey: true,
    }),
    text("name"),
    text("email"),
  );
  const categoriesTable = table(
    "categories",
    uuid("id", {
      primaryKey: true,
    }),
    text("name"),
  );
  const productsTable = table(
    "products",
    uuid("id", { primaryKey: true }),
    uuid("category_id", {
      foreignKey: {
        table: "categories",
        col: "id",
      },
    }),
    integer("price"),
    text("product_name"),
  );
  const ordersTable = table(
    "orders",
    uuid("id", { primaryKey: true }),
    uuid("user_id", {
      foreignKey: {
        table: "users",
        col: "id",
      },
    }),
    uuid("product_id", {
      foreignKey: {
        table: "products",
        col: "id",
      },
    }),
    integer("quantity"),
  );

  const NUM_USERS = 20;
  const NUM_CATEGORIES = 10;
  const NUM_PRODUCTS = 200;

  const POTENTIAL_CATEGORIES = [
    "electronics",
    "clothing",
    "food",
    "books",
    "toys",
    "games",
    "sports",
    "tools",
    "furniture",
    "appliances",
  ];

  const users: Data[] = [];
  const categories: Data[] = [];
  const products: Data[] = [];
  const orders: Data[] = [];

  beforeAll(async () => {
    await tdb.create(usersTable, categoriesTable, productsTable, ordersTable);

    for (let i = 0; i < NUM_USERS; i++) {
      const input = inputs[i % inputs.length];
      const user = await createRowForTest(
        {
          tableName: "users",
          fields: {
            id: v1(),
            name: `${input.firstName} ${input.lastName}`,
            email: randomEmail(),
          },
        },
        "RETURNING *",
      );
      expect(user).not.toBeUndefined();
      users.push(user!);
    }

    for (let i = 0; i < NUM_CATEGORIES; i++) {
      const category = await createRowForTest(
        {
          tableName: "categories",
          fields: {
            id: v1(),
            name: POTENTIAL_CATEGORIES[i % POTENTIAL_CATEGORIES.length],
          },
        },
        "RETURNING *",
      );
      expect(category).not.toBeUndefined();
      categories.push(category!);
    }

    for (let i = 0; i < NUM_PRODUCTS; i++) {
      const category = categories[i % categories.length];
      const category_id = category.id;
      const product = await createRowForTest(
        {
          tableName: "products",
          fields: {
            id: v1(),
            category_id,
            product_name: `${Math.random().toString(16).substring(2)}_${
              category.name
            }`,
            price: Math.floor(Math.random() * 100),
          },
        },
        "RETURNING *",
      );
      expect(product).not.toBeUndefined();
      products.push(product!);
    }
    function getRandomNumber(min: number, max: number) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    const min = Math.floor(NUM_PRODUCTS / NUM_USERS) * 10;
    const max = min * 4;
    // increased these numbers so that we can have enough numbers
    // when querying for the most ordered product by a given user in a category
    for (const user of users) {
      for (let i = 0; i < getRandomNumber(min, max); i++) {
        const product = products[i % products.length];
        const product_id = product.id;
        const quantity = Math.floor(Math.random() * 10);
        const order = await createRowForTest(
          {
            tableName: "orders",
            fields: {
              id: v1(),
              user_id: user.id,
              product_id,
              quantity,
            },
          },
          "RETURNING *",
        );
        console.assert(order, `couldn't create order`);
        orders.push(order!);
      }
    }
  });

  // ~20
  test("query users for product", async () => {
    // find the most ordered product
    const r = await DB.getInstance().getPool().query(`
          SELECT
      p.id,
          COUNT(DISTINCT o.user_id) AS num_users
      FROM 
          orders o
      JOIN 
          products p ON p.id = o.product_id
      GROUP BY 
          p.id
      ORDER BY 
          num_users DESC
      LIMIT 1;
`);
    const expCount = parseInt(r.rows[0].num_users, 10);

    const productId = r.rows[0].id;
    // query for the users who ordered that product
    const r2 = await DB.getInstance()
      .getPool()
      .query(
        `SELECT
        u.id,
        u.name,
        u.email
    FROM
        users u
    JOIN
        orders o ON u.id = o.user_id
    JOIN
        products p ON o.product_id = p.id
    WHERE
        p.id = $1
    ORDER BY u.name DESC, u.id DESC
        `,
        [productId],
      );

    expect(r2.rows.length).toEqual(expCount);

    // now let's do an ent query for it and the results should be the same

    const getQuery = () => {
      return new CustomClauseQuery(new LoggedOutViewer(), {
        clause: clause.Eq("id", productId, "p"),
        name: "users_purchased_product",
        loadEntOptions: AnyEnt.loaderOptions("users", ["id", "name", "email"]),
        orderby: [
          {
            column: "name",
            direction: "DESC",
          },
        ],
        joinBETA: [
          {
            tableName: "orders",
            alias: "o",
            clause: clause.Expression("u.id = o.user_id"),
          },
          {
            tableName: "products",
            alias: "p",
            clause: clause.Expression("o.product_id = p.id"),
          },
        ],
      });
    };

    const q = getQuery();

    const [edges, count, rawCount, ents] = await Promise.all([
      q.queryEdges(),
      q.queryCount(),
      q.queryRawCount(),
      q.queryEnts(),
    ]);
    expect(edges.length).toBe(expCount);
    expect(count).toBe(expCount);
    expect(rawCount).toBe(expCount);
    expect(ents.length).toBe(expCount);

    expect(edges).toStrictEqual(r2.rows);
    expect(ents.map((ent) => ent.id)).toStrictEqual(
      r2.rows.map((row) => row.id),
    );

    await paginateAndVerifyClauseWithJoin(getQuery, edges);

    ml.clear();

    // can perform same query Foo.loadCustom if CustomClauseQuery is overkill
    // maybe loadCustom should wrap CustomClauseQuery with a limit intentionally disabled
    // so logic isn't duplicated?
    const loaderOptions = AnyEnt.loaderOptions("users", [
      "id",
      "name",
      "email",
    ]);
    delete loaderOptions.alias;
    const customEnts = await loadCustomEnts(
      new LoggedOutViewer(),
      loaderOptions,
      {
        // intentionally different alias than what AnyEnt.loaderOptions would have done
        alias: "u2",
        clause: clause.Eq("id", productId, "p"),
        orderby: [
          {
            column: "name",
            direction: "DESC",
          },
          // have to add this manually since not a query and this isn't done for us because no pagination is happening
          {
            column: "id",
            direction: "DESC",
          },
        ],
        join: [
          {
            tableName: "orders",
            alias: "o",
            clause: clause.Expression("u2.id = o.user_id"),
          },
          {
            tableName: "products",
            alias: "p",
            clause: clause.Expression("o.product_id = p.id"),
          },
        ],
      },
    );
    // can construct a query with loadCustomEnts e.g. Foo.loadCustom and still do joins with an alias and
    // get the same result
    expect(ents.length).toBe(customEnts.length);
    expect(ents.map((ent) => ent.id)).toStrictEqual(
      customEnts.map((row) => row.id),
    );
  });

  // ~147
  test("query products for user", async () => {
    // find the user who ordered the most products
    const r = await DB.getInstance().getPool().query(`
          SELECT
      u.id,
          COUNT(DISTINCT o.product_id) AS num_products
      FROM 
          users u
      JOIN 
          orders o ON u.id = o.user_id
      GROUP BY 
          u.id
      ORDER BY 
          num_products DESC
      LIMIT 1;
`);

    const expCount = parseInt(r.rows[0].num_products, 10);

    const userId = r.rows[0].id;
    // query for the products ordered by that user
    // 2 simple ways to do this
    const r2 = await DB.getInstance()
      .getPool()
      .query(
        `SELECT
        p.id,
        p.category_id,
        p.price,
        p.product_name
    FROM
        users u
    JOIN
        orders o ON u.id = o.user_id
    JOIN
        products p ON o.product_id = p.id
    WHERE
        u.id = $1
    ORDER BY p.product_name DESC, p.id DESC
        `,
        [userId],
      );

    expect(r2.rows.length).toEqual(expCount);

    const r3 = await DB.getInstance()
      .getPool()
      .query(
        `SELECT
        p.id,
        p.category_id,
        p.price,
        p.product_name
    FROM
        orders o
    JOIN
        products p ON o.product_id = p.id
    WHERE
        o.user_id = $1
    ORDER BY p.product_name DESC, p.id DESC
        `,
        [userId],
      );
    expect(r3.rows.length).toEqual(expCount);

    const getQuery = () => {
      return new CustomClauseQuery(new LoggedOutViewer(), {
        // aliasing with u since the where clause is from table users
        clause: clause.Eq("id", userId, "u"),
        name: "products_purchased_by_user_1",
        // tableName is users because we're querying from users
        loadEntOptions: AnyEnt.loaderOptions(
          "users",
          ["id", "category_id", "price", "product_name"],
          {
            // fields alias because we're getting fields from product
            fieldsAlias: "p",
          },
        ),
        orderby: [
          {
            // orderby will get the fields alias by default since ordering by column we're selecting from
            column: "product_name",
            direction: "DESC",
          },
        ],
        joinBETA: [
          {
            tableName: "orders",
            alias: "o",
            clause: clause.Expression("u.id = o.user_id"),
          },
          {
            tableName: "products",
            alias: "p",
            clause: clause.Expression("o.product_id = p.id"),
          },
        ],
      });
    };

    const q = getQuery();

    const [edges, count, rawCount, ents] = await Promise.all([
      q.queryEdges(),
      q.queryCount(),
      q.queryRawCount(),
      q.queryEnts(),
    ]);
    expect(edges.length).toBe(expCount);
    expect(count).toBe(expCount);
    expect(rawCount).toBe(expCount);
    expect(ents.length).toBe(expCount);

    expect(edges).toStrictEqual(r2.rows);
    expect(ents.map((ent) => ent.id)).toStrictEqual(
      r2.rows.map((row) => row.id),
    );

    const getQuery2 = () => {
      return new CustomClauseQuery(new LoggedOutViewer(), {
        // aliasing with o since the where clause is from table orders
        clause: clause.Eq("user_id", userId, "o"),
        name: "products_purchased_by_user_2",
        // tableName is orders because we're querying from orders
        loadEntOptions: AnyEnt.loaderOptions(
          "orders",
          ["id", "category_id", "price", "product_name"],
          {
            // fields alias because we're getting fields from product
            fieldsAlias: "p",
          },
        ),
        orderby: [
          {
            // orderby will get the fields alias by default since ordering by column we're selecting from
            column: "product_name",
            direction: "DESC",
          },
        ],
        joinBETA: [
          {
            tableName: "products",
            alias: "p",
            clause: clause.Expression("o.product_id = p.id"),
          },
        ],
      });
    };

    const q2 = getQuery2();

    const [edges2, count2, rawCount2, ents2] = await Promise.all([
      q2.queryEdges(),
      q2.queryCount(),
      q2.queryRawCount(),
      q2.queryEnts(),
    ]);
    expect(edges2.length).toBe(expCount);
    expect(count2).toBe(expCount);
    expect(rawCount2).toBe(expCount);
    expect(ents2.length).toBe(expCount);

    expect(edges2).toStrictEqual(r2.rows);
    expect(ents2.map((ent) => ent.id)).toStrictEqual(
      r2.rows.map((row) => row.id),
    );

    await paginateAndVerifyClauseWithJoin(getQuery, edges);

    await paginateAndVerifyClauseWithJoin(getQuery2, edges2);
  });

  // ~15
  test("query products for user in given category", async () => {
    const r = await DB.getInstance().getPool().query(`
WITH UserCategoryOrders AS (
    SELECT 
        u.id as uid,
        c.id as cid,
        COUNT(DISTINCT o.product_id) AS num_products
    FROM 
        users u
    JOIN 
        orders o ON u.id = o.user_id
    JOIN 
        products p ON o.product_id = p.id
    JOIN 
        categories c ON p.category_id = c.id
    GROUP BY 
        u.id, c.id
)

SELECT 
    uid,
    cid,
    num_products
FROM 
    UserCategoryOrders
ORDER BY 
    num_products DESC
LIMIT 1;
`);
    const expCount = parseInt(r.rows[0].num_products, 10);
    const userId = r.rows[0].uid;
    const categoryId = r.rows[0].cid;

    const r2 = await DB.getInstance()
      .getPool()
      .query(
        `SELECT
        p.id,
        p.category_id,
        p.price,
        p.product_name
    FROM
        orders o
    JOIN
        products p ON o.product_id = p.id
    WHERE
        o.user_id = $1
    AND
        p.category_id = $2
    ORDER BY p.product_name DESC, p.id DESC`,
        [userId, categoryId],
      );

    expect(r2.rows.length).toEqual(expCount);

    const getQuery = () => {
      return new CustomClauseQuery(new LoggedOutViewer(), {
        clause: clause.And(
          clause.Eq("user_id", userId, "o"),
          clause.Eq("category_id", categoryId, "p"),
        ),
        name: "products_purchased_by_user_category",
        loadEntOptions: AnyEnt.loaderOptions(
          "orders",
          ["id", "category_id", "price", "product_name"],
          {
            // fields alias because we're getting fields from product
            fieldsAlias: "p",
          },
        ),
        orderby: [
          {
            // orderby will get the fields alias by default since ordering by column we're selecting from
            column: "product_name",
            direction: "DESC",
          },
        ],
        joinBETA: [
          {
            tableName: "products",
            alias: "p",
            clause: clause.Expression("o.product_id = p.id"),
          },
        ],
      });
    };

    const q = getQuery();

    const [edges, count, rawCount, ents] = await Promise.all([
      q.queryEdges(),
      q.queryCount(),
      q.queryRawCount(),
      q.queryEnts(),
    ]);
    expect(edges.length).toBe(expCount);
    expect(count).toBe(expCount);
    expect(rawCount).toBe(expCount);
    expect(ents.length).toBe(expCount);

    expect(edges).toStrictEqual(r2.rows);
    expect(ents.map((ent) => ent.id)).toStrictEqual(
      r2.rows.map((row) => row.id),
    );

    await paginateAndVerifyClauseWithJoin(getQuery, edges);
  });
});

function getPaginationVerifyClauseWithJoin<T extends Ent>(
  toQuery: () => CustomClauseQuery<T>,
  edges: Data[],
  perPage: number,
  first = true, // if false, we're going backwards and using last()
) {
  async function verify(
    idx: number,
    hasEdge: boolean,
    hasNextOrLastPage: boolean,
    cursor?: string,
  ) {
    let q2: CustomClauseQuery<T>;
    if (first) {
      q2 = toQuery().first(perPage, cursor);
    } else {
      q2 = toQuery().last(perPage, cursor);
    }

    const options = q2.__getOptions();

    const orderBy = options.orderby!;
    expect(orderBy.length).toBe(1);
    const less = orderBy[0].direction === "DESC";
    orderBy.push({
      column: "id",
      direction: orderBy[0].direction,
    });
    let cls = options.clause;
    if (cursor) {
      cls = clause.AndOptional(
        cls,
        clause.PaginationMultipleColsQuery(
          // same column from orderBy
          orderBy[0].column,
          "id",
          less,
          // these 2 values don't matter so just putting whatever
          new Date().getTime(),
          4,
          options.loadEntOptions.fieldsAlias ?? options.loadEntOptions.alias,
        ),
      );
    }

    const ents = await q2.queryEnts();
    const newEdges = await q2.queryEdges();
    const query = buildQuery({
      // tableName, fieldsAlias, alias all from here
      ...options.loadEntOptions,
      distinct: true,
      orderby: orderBy,
      limit: perPage + 1,
      clause: cls,
      join: options.joinBETA,
    });
    expect(query, idx.toString()).toEqual(ml.logs[ml.logs.length - 1].query);

    // 1 is a hack...
    const pagination = q2.paginationInfo().get(1);
    if (hasEdge) {
      expect(ents.length, idx.toString()).toBeGreaterThan(0);
      expect(ents.length, idx.toString()).toBeLessThanOrEqual(perPage);
      expect(ents[0].id, idx.toString()).toBe(edges[idx].id);
    } else {
      expect(ents.length, idx.toString()).toBe(0);
      expect(newEdges.length, idx.toString()).toBe(0);
    }

    if (hasNextOrLastPage) {
      // has exact if next page
      expect(ents.length, idx.toString()).toBe(perPage);

      if (first) {
        expect(pagination?.hasNextPage, idx.toString()).toBe(true);
        expect(pagination?.hasPreviousPage, idx.toString()).toBe(false);
      } else {
        expect(pagination?.hasPreviousPage, idx.toString()).toBe(true);
        expect(pagination?.hasNextPage, idx.toString()).toBe(false);
      }
    } else {
      expect(pagination?.hasNextPage, idx.toString()).toBe(undefined);
      expect(pagination?.hasPreviousPage, idx.toString()).toBe(undefined);
    }
  }

  return verify;
}

// this paginates forwards and backwards and verifies that it returns
// values in the list
// TODO: get this logic somewhere else and use it in all these places that does pagination tests?
async function paginateAndVerifyClauseWithJoin<T extends Ent>(
  toQuery: () => CustomClauseQuery<T>,
  edges: Data[],
) {
  ml.clear();

  const reverseQ = toQuery().last(100000);
  const reverseEdges = await reverseQ.queryEdges();
  expect(reverseEdges.length).toBe(edges.length);
  // make sure we use a different array here for the check because reverse() reverses in place...
  expect([...reverseEdges].reverse()).toStrictEqual(edges);

  // query up to 10 times
  // page number at least 2
  const perPage = Math.max(Math.floor(edges.length / 10), 2);
  const q = toQuery();

  const verify = getPaginationVerifyClauseWithJoin(toQuery, edges, perPage);

  let last: Data | undefined = undefined;
  for (let i = 0; i < 10; i++) {
    let cursor: string | undefined = undefined;
    if (last) {
      cursor = q.getCursor(last);
    }
    // let hasEdge = edges[i * perPage] !== undefined;
    const hasEdge = i * perPage < edges.length;
    last = edges[i * perPage + perPage - 1];
    // hasMorePages | last issues | cursor
    let hasMorePages = edges[(i + 1) * perPage] !== undefined;
    await verify(i * perPage, hasEdge, hasMorePages, cursor);
    if (!hasMorePages) {
      break;
    }
    last = edges[(i + 1) * perPage - 1];
  }

  const toQueryReverse = () => {
    const q = toQuery();
    const options = q.__getOptions();
    let orderby = options.orderby;
    if (orderby) {
      orderby = reverseOrderBy(orderby);
    }
    options.orderby = orderby;
    return q;
  };
  const qLast = toQueryReverse();

  const verifyLast = getPaginationVerifyClauseWithJoin(
    toQueryReverse,
    reverseEdges,
    perPage,
    false,
  );

  let first: Data | undefined = undefined;
  for (let i = 0; i < 10; i++) {
    let cursor: string | undefined = undefined;
    if (first) {
      cursor = qLast.getCursor(first);
    }
    // let hasEdge = edges[i * perPage] !== undefined;
    const hasEdge = i * perPage < reverseEdges.length;
    last = reverseEdges[i * perPage + perPage - 1];
    // hasMorePages | last issues | cursor
    let hasMorePages = reverseEdges[(i + 1) * perPage] !== undefined;
    await verifyLast(i * perPage, hasEdge, hasMorePages, cursor);
    if (!hasMorePages) {
      break;
    }
    first = reverseEdges[(i + 1) * perPage - 1];
  }
}
