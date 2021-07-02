import { TestContext } from "../../testutils/context/test_context";
import { setLogLevels } from "../logger";
import { MockLogs } from "../../testutils/mock_log";
import { buildQuery, DefaultLimit } from "../ent";
import * as clause from "../clause";
import { Data, EdgeQueryableDataOptions, ID, Loader } from "../base";
import { setupSqlite, TempDB } from "../../testutils/db/test_db";
import {
  FakeUser,
  FakeEvent,
  EventCreateInput,
  getNextWeekClause,
  getCompleteClause,
} from "../../testutils/fake_data/index";
import {
  createAllEvents,
  createTestUser,
  setupTempDB,
  tempDBTables,
} from "../../testutils/fake_data/test_helpers";

import { QueryLoaderFactory } from "./query_loader";
import { advanceBy, advanceTo, clear } from "jest-date-mock";
import { MockDate } from "../../testutils/mock_date";

const ml = new MockLogs();
let tdb: TempDB;

let ctx: TestContext;

// we get 7 back because we're looking at a week
const DAYS = 7;
const HOW_MANY = 10;
// every 24 hours
const INTERVAL = 24 * 60 * 60 * 1000;

const getNewLoader = (context: boolean = true) => {
  return new QueryLoaderFactory({
    groupCol: "user_id",
    ...FakeEvent.loaderOptions(),
    clause: getNextWeekClause(),
    sortColumn: "start_time asc",
  }).createLoader(context ? ctx : undefined);
};

const getConfigurableLoader = (
  context: boolean,
  options: EdgeQueryableDataOptions,
) => {
  return new QueryLoaderFactory({
    groupCol: "user_id",
    ...FakeEvent.loaderOptions(),
    clause: getNextWeekClause(),
    sortColumn: "start_time asc",
  }).createConfigurableLoader(options, context ? ctx : undefined);
};

const getNonGroupableLoader = (id: ID, context: boolean = true) => {
  return new QueryLoaderFactory({
    ...FakeEvent.loaderOptions(),
    clause: getCompleteClause(id),
    sortColumn: "start_time asc",
  }).createLoader(context ? ctx : undefined);
};

describe("postgres", () => {
  beforeAll(async () => {
    setLogLevels(["query", "error"]);
    ml.mock();

    tdb = await setupTempDB();
  });

  beforeEach(() => {
    // reset context for each test
    ctx = new TestContext();
  });

  afterEach(() => {
    ml.clear();
  });

  afterAll(async () => {
    ml.restore();
    await tdb.afterAll();
  });
  commonTests();
});

describe("sqlite", () => {
  setupSqlite(`sqlite:///query_loader.db`, tempDBTables);

  beforeAll(async () => {
    setLogLevels(["query", "error"]);
    ml.mock();
  });

  beforeEach(async () => {
    // reset context for each test
    ctx = new TestContext();
    // create once
    //    await createEdges();
  });

  afterEach(() => {
    ml.clear();
  });

  afterAll(async () => {
    ml.restore();
  });
  commonTests();
});

// index_loader.test.ts tests a lof of things that this tests so we don't test every path here
// just the "complex" ones
function commonTests() {
  describe("groupCol passed", () => {
    test("single id. with context", async () => {
      await verifySingleIDWithContextCacheHit((id) => getNewLoader());
    });

    test("single id. without context", async () => {
      await verifySingleIDWithoutContextCacheHit((id) => getNewLoader(false));
    });

    test("multi-ids. with context", async () => {
      await testMultiQueryDataAvail(
        (opts) => getConfigurableLoader(true, opts),
        (ids) => {
          expect(ml.logs.length).toBe(1);
          expect(ml.logs[0].query).toMatch(/^SELECT * /);
          expect(ml.logs[0].values.length).toBe(ids.length + 2);
          // not testing actual values for timestamp here because time has probably advanced since test ran
          expect(ml.logs[0].values.slice(0, ids.length)).toEqual(ids);
        },
        verifyGroupedCacheHit,
      );
    });

    test("multi-ids. without context", async () => {
      await testMultiQueryDataAvail(
        (opts) => getConfigurableLoader(false, opts),
        verifyMultiCountQueryCacheMiss,
        verifyMultiCountQueryCacheMiss,
      );
    });

    test("multi-ids. with context, offset", async () => {
      await testMultiQueryDataOffset((options) =>
        getConfigurableLoader(true, options),
      );
    });

    test("multi-ids. without context, offset", async () => {
      await testMultiQueryDataOffset((options) =>
        getConfigurableLoader(false, options),
      );
    });

    test("multi-ids. with context different limits", async () => {
      let data = await createData();

      // initial. default limit
      await testMultiQueryDataAvail(
        (opts) => getConfigurableLoader(true, opts),
        (ids) => {
          expect(ml.logs.length).toBe(1);
          expect(ml.logs[0].query).toMatch(/^SELECT * /);
          //        expect(ml.logs[0].values).toEqual(ids);
          expect(ml.logs[0].values.length).toBe(ids.length + 2);
          // not testing actual values for timestamp here because time has probably advanced since test ran
          expect(ml.logs[0].values.slice(0, ids.length)).toEqual(ids);
        },
        verifyGroupedCacheHit,
        undefined,
        data,
      );

      // query again with same data and same limit and it should all be cache hits
      await testMultiQueryDataAvail(
        (opts) => getConfigurableLoader(true, opts),
        verifyGroupedCacheHit,
        verifyGroupedCacheHit,
        undefined,
        data,
      );

      // change slice e.g. first N and now we hit the db again

      await testMultiQueryDataAvail(
        (opts) => getConfigurableLoader(true, opts),
        (ids) => {
          expect(ml.logs.length).toBe(1);
          expect(ml.logs[0].query).toMatch(/^SELECT * /);
          //        expect(ml.logs[0].values).toEqual(ids);
          expect(ml.logs[0].values.length).toBe(ids.length + 2);
          // not testing actual values for timestamp here because time has probably advanced since test ran
          expect(ml.logs[0].values.slice(0, ids.length)).toEqual(ids);
        },
        verifyGroupedCacheHit,
        3,
        data,
      );

      // query for first 3 again and all hits
      await testMultiQueryDataAvail(
        (opts) => getConfigurableLoader(true, opts),
        verifyGroupedCacheHit,
        verifyGroupedCacheHit,
        3,
        data,
      );

      // change slice e.g. first N and now we hit the db again
      await testMultiQueryDataAvail(
        (opts) => getConfigurableLoader(true, opts),
        // TODO move this intoa function
        (ids) => {
          expect(ml.logs.length).toBe(1);
          expect(ml.logs[0].query).toMatch(/^SELECT * /);
          //        expect(ml.logs[0].values).toEqual(ids);
          expect(ml.logs[0].values.length).toBe(ids.length + 2);
          // not testing actual values for timestamp here because time has probably advanced since test ran
          expect(ml.logs[0].values.slice(0, ids.length)).toEqual(ids);
        },
        verifyGroupedCacheHit,
        2,
        data,
      );
    });

    test("multi-ids. with no context different limits", async () => {
      let data = await createData();

      // initial. default limit
      await testMultiQueryDataAvail(
        (opts) => getConfigurableLoader(false, opts),
        verifyMultiCountQueryCacheMiss,
        verifyMultiCountQueryCacheMiss,
        undefined,
        data,
      );

      // // query again with same data and same limit and still we refetch it all
      await testMultiQueryDataAvail(
        (opts) => getConfigurableLoader(false, opts),
        verifyMultiCountQueryCacheMiss,
        verifyMultiCountQueryCacheMiss,
        undefined,
        data,
      );

      // change slice e.g. first N and now we hit the db again
      await testMultiQueryDataAvail(
        (opts) => getConfigurableLoader(false, opts),
        verifyMultiCountQueryCacheMiss,
        verifyMultiCountQueryCacheMiss,
        3,
        data,
      );

      // refetch for 3. hit db again
      await testMultiQueryDataAvail(
        (opts) => getConfigurableLoader(false, opts),
        verifyMultiCountQueryCacheMiss,
        verifyMultiCountQueryCacheMiss,
        3,
        data,
      );

      // change slice e.g. first N and now we hit the db again
      await testMultiQueryDataAvail(
        (opts) => getConfigurableLoader(false, opts),
        verifyMultiCountQueryCacheMiss,
        verifyMultiCountQueryCacheMiss,
        3,
        data,
      );
    });
  });

  describe("clause only", () => {
    // single
    // so this doesn't actually make sense as a loader because the id is part of the query
    // the reason to support this is for EntQuery and connection support
    // also in case the query is repeated within the same request but that's probably not that likely
    test("single id. with context", async () => {
      const [user, events] = await verifySingleIDWithContextCacheHit((id) =>
        getNonGroupableLoader(id),
      );

      ml.clear();

      const loader2 = getNonGroupableLoader(user.id);
      const edges = await loader2.load(user.id);
      verifyUserToEventsRawData(edges, events);
      // if query made with same starttime and endtime, we hit the in-memory cache now
      verifyGroupedCacheHit([user.id]);

      // even with different user, same result since id is baked into query
      const user2 = await createTestUser();
      const edges2 = await loader2.load(user2.id);
      verifyUserToEventsRawData(edges2, events);
    });

    test("single id. without context", async () => {
      await verifySingleIDWithoutContextCacheHit((id) =>
        getNonGroupableLoader(id, false),
      );
    });

    test("multi-ids", async () => {
      const data = await createData();
      let { m, ids, users } = data;
      ml.clear();

      const edges = await Promise.all(
        ids.map(async (id) => {
          // have to use different loader for each to get results
          const loader = getNonGroupableLoader(id);
          return await loader.load(id);
        }),
      );
      ml.verifyNoErrors();

      // hits db for each query
      verifyMultiCountQueryCacheMiss(ids);
      // data is correct
      verifyGroupedData(ids, users, edges, m);
    });

    // multi-ids. have to use different loaders, just fetching at same time
  });

  async function verifySingleIDWithContextCacheHit(
    loaderFn: (id: ID) => Loader<ID, Data[]>,
  ): Promise<[FakeUser, FakeEvent[]]> {
    const [user, events] = await createAllEvents({
      howMany: HOW_MANY,
      interval: INTERVAL,
    });
    // create another one just to make sure we're doing some filtering
    await createAllEvents({ howMany: 5, interval: 100 });

    ml.clear();
    const loader = loaderFn(user.id);
    //    const loader = getNewLoader();
    const edges = await loader.load(user.id);

    // we get 7 back because we're just looking at the next week's events
    expect(edges.length).toBe(DAYS);
    verifyUserToEventsRawData(edges, events);
    verifyMultiCountQueryCacheMiss([user.id]);

    ml.clear();
    const edges2 = await loader.load(user.id);
    expect(edges).toStrictEqual(edges2);

    verifyGroupedCacheHit([user.id]);

    return [user, events];
  }

  async function verifySingleIDWithoutContextCacheHit(
    loaderFn: (id: ID) => Loader<ID, Data[]>,
  ) {
    const [user, events] = await createAllEvents({
      howMany: HOW_MANY,
      // every 24 hours
      interval: INTERVAL,
    });
    // create another one just to make sure we're doing some filtering
    await createAllEvents({ howMany: 5, interval: 100 });

    ml.clear();
    const loader = loaderFn(user.id);
    const edges = await loader.load(user.id);

    // we get 7 back because we're just looking at the next week's events
    expect(edges.length).toBe(DAYS);
    verifyUserToEventsRawData(edges, events);
    verifyMultiCountQueryCacheMiss([user.id]);

    ml.clear();
    const edges2 = await loader.load(user.id);
    expect(edges).toStrictEqual(edges2);

    verifyMultiCountQueryCacheMiss([user.id]);
  }

  function verifyUserToEventsRawData(edges: Data[], events: FakeEvent[]) {
    const expEvents = events.slice(0, DAYS);
    expect(edges.length).toBe(expEvents.length);

    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const expEdge = events[i].data;
      // both raw from db so no conversion needed
      expect(edge, `${i}th index`).toMatchObject(expEdge);
    }
  }

  function verifyMultiCountQueryCacheMiss(ids: ID[], slice?: number) {
    expect(ml.logs.length).toBe(ids.length);
    ml.logs.forEach((log, idx) => {
      const expQuery = buildQuery({
        tableName: "fake_events",
        fields: FakeEvent.loaderOptions().fields,
        clause: getCompleteClause(ids[idx]),
        orderby: "start_time asc",
        limit: slice || DefaultLimit,
      });
      // not testing actual values for timestamp here because time has probably advanced since test ran
      expect(log.query).toEqual(expQuery);
      expect(log.values.length).toBe(3);
      expect(log.values[0]).toEqual(ids[idx]);
    });
  }

  function verifyGroupedCacheHit(ids: ID[]) {
    ml.verifyNoErrors();
    expect(ml.logs.length).toBe(ids.length);
    // cache hit for each id
    ml.logs.forEach((log, idx) => {
      expect(log).toStrictEqual({
        "dataloader-cache-hit": ids[idx],
        "tableName": "fake_events",
      });
    });
  }

  interface createdData {
    m: Map<ID, FakeEvent[]>;
    ids: ID[];
    users: FakeUser[];
  }

  async function createData(): Promise<createdData> {
    const m = new Map<ID, FakeEvent[]>();
    const ids: ID[] = [];
    const users: FakeUser[] = [];

    //    const date = MockDate.getDate();
    // resets
    advanceTo(MockDate.getDate());
    const inputs: Partial<EventCreateInput>[] = [];
    for (let i = 0; i < HOW_MANY; i++) {
      // we only care about startTime here and that's the sortCol
      advanceBy(INTERVAL);
      inputs.push({
        startTime: new Date(),
      });
    }

    await Promise.all(
      [1, 2, 3, 4, 5].map(async (count, idx) => {
        let [user, events] = await createAllEvents({
          howMany: HOW_MANY,
          // don't advance here...
          interval: 0,
          // advancing handled here
          eventInputs: inputs,
        });

        m.set(user.id, events);
        ids[idx] = user.id;
        users[idx] = user;
      }),
    );
    return { m, ids, users };
  }

  async function testMultiQueryDataAvail(
    loaderFn: (opts: EdgeQueryableDataOptions) => Loader<ID, Data[]>,
    verifyPostFirstQuery: (ids: ID[], slice?: number) => void,
    verifyPostSecondQuery: (ids: ID[], slice?: number) => void,
    slice?: number,
    data?: createdData,
  ) {
    if (!data) {
      data = await createData();
    }
    let { m, ids, users } = data;

    // clear post creation
    ml.clear();

    // TODO this needs to be done prior to the JS event loop
    // need to make this work for scenarios where the loader is created in same loop
    const loader = loaderFn({
      limit: slice,
    });
    const edges = await Promise.all(ids.map(async (id) => loader.load(id)));
    ml.verifyNoErrors();

    verifyGroupedData(ids, users, edges, m, slice);

    verifyPostFirstQuery(ids, slice);

    ml.clear();

    // reload data
    const edges2 = await Promise.all(ids.map(async (id) => loader.load(id)));

    verifyGroupedData(ids, users, edges2, m, slice);
    expect(edges).toStrictEqual(edges2);

    verifyPostSecondQuery(ids, slice);
  }

  function verifyGroupedData(
    ids: ID[],
    users: FakeUser[],
    edges: Data[][],
    m: Map<ID, FakeEvent[]>,
    slice?: number,
  ) {
    for (let i = 0; i < ids.length; i++) {
      const user = users[i];
      let events = m.get(user.id) || [];
      events = events.slice(0, DAYS);
      if (slice) {
        events = events.slice(0, slice);
      }

      expect(
        edges[i].length,
        `count for idx ${i} for id ${ids[i]} was not as expected`,
      ).toBe(events.length);

      // verify the edges are as expected
      verifyUserToEventsRawData(edges[i], events);
    }
  }

  async function testMultiQueryDataOffset(
    loaderFn: (opts: EdgeQueryableDataOptions) => Loader<ID, Data[]>,
  ) {
    const { m, ids, users } = await createData();

    // clear post creation
    ml.clear();

    const edges = await Promise.all(
      ids.map(async (id) => {
        const events = m.get(id) || [];
        const options = {
          // how an offset query works
          clause: clause.Greater(
            "start_time",
            events[0].startTime.toISOString(),
          ),
          limit: 1,
        };

        const loader = loaderFn(options);
        return loader.load(id);
      }),
    );
    ml.verifyNoErrors();

    // this doesn't exist here since the id count is different
    // TODO we should change that???
    // we get one edge for each that returned (other than the one with just one row)
    for (let i = 0; i < ids.length; i++) {
      let expEvents: FakeEvent[] = [];
      const user = users[i];

      expEvents = [(m.get(user.id) || [])[1]];
      expect(
        edges[i].length,
        `count for idx ${i} for id ${ids[i]} was not as expected`,
        // 1 row returned for everything but first one
      ).toBe(expEvents.length);

      // verify the edges are as expected
      // just the one (if result exists)
      verifyUserToEventsRawData(edges[i], expEvents);
    }
    verifyMultiCountQueryOffset(ids, m);

    ml.clear();

    // reload data
    const edges2 = await Promise.all(
      ids.map(async (id) => {
        const events = m.get(id) || [];
        const options = {
          clause: clause.Greater(
            "start_time",
            events[0].startTime.toISOString(),
          ),
          limit: 1,
        };

        const loader = loaderFn(options);
        return loader.load(id);
      }),
    );

    // query again, same data
    // if context, we hit local cache. otherwise, hit db
    expect(edges).toStrictEqual(edges2);
    verifyMultiCountQueryOffset(ids, m);
  }

  function verifyMultiCountQueryOffset(ids: ID[], m: Map<ID, FakeEvent[]>) {
    expect(ml.logs.length).toBe(ids.length);
    ml.logs.forEach((log, idx) => {
      let events = m.get(ids[idx]) || [];
      const fields = FakeEvent.loaderOptions().fields;

      const cls = clause.And(
        getCompleteClause(ids[idx]),
        clause.Greater("start_time", events[0].startTime.toISOString()),
      );

      const expQuery = buildQuery({
        tableName: "fake_events",
        fields: fields,
        clause: cls,
        orderby: "start_time asc",
        limit: 1,
      });
      expect(log.query).toEqual(expQuery);
      expect(log.values[0]).toEqual(ids[idx]);
      //      console.debug(log.values);
      // not testing the rest because difficult
    });
  }
}
