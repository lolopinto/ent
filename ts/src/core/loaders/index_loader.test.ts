import { v4 as uuidv4 } from "uuid";

import { TestContext } from "../../testutils/context/test_context";
import { setLogLevels } from "../logger";
import { MockLogs } from "../../testutils/mock_log";
import { buildQuery, DefaultLimit } from "../ent";
import * as clause from "../clause";

import { Data, EdgeQueryableDataOptions, ID, Loader } from "../base";
import { setupSqlite, TempDB } from "../../testutils/db/test_db";
import {
  FakeUser,
  FakeContact,
  contactLoader,
  userToContactsDataLoaderFactory,
} from "../../testutils/fake_data/index";
import {
  createAllContacts,
  setupTempDB,
  tempDBTables,
  verifyUserToContactRawData,
} from "../../testutils/fake_data/test_helpers";

import { IndexLoaderFactory } from "./index_loader";
// most of this is copied from assoc_edge_loader.test.ts and changed to work for this

const ml = new MockLogs();
let tdb: TempDB;

let ctx: TestContext;

const getNewLoader = (context: boolean = true) => {
  return new IndexLoaderFactory(
    FakeContact.loaderOptions(),
    "user_id",
  ).createLoader(context ? ctx : undefined);
};

const getConfigurableLoader = (
  context: boolean,
  options: EdgeQueryableDataOptions,
) => {
  return new IndexLoaderFactory(
    FakeContact.loaderOptions(),
    "user_id",
  ).createConfigurableLoader(options, context ? ctx : undefined);
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
  setupSqlite(`sqlite:///index_loader.db`, tempDBTables);

  beforeAll(async () => {
    setLogLevels(["query", "error"]);
    ml.mock();
  });

  beforeEach(async () => {
    // reset context for each test
    ctx = new TestContext();
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
  test("multi-ids. with context", async () => {
    await testMultiQueryDataAvail(
      (opts) => getConfigurableLoader(true, opts),
      (ids) => {
        expect(ml.logs.length).toBe(1);
        expect(ml.logs[0].query).toMatch(/^SELECT * /);
        expect(ml.logs[0].values).toEqual(ids);
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
        expect(ml.logs[0].values).toEqual(ids);
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
        expect(ml.logs[0].values).toEqual(ids);
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
      (ids) => {
        expect(ml.logs.length).toBe(1);
        expect(ml.logs[0].query).toMatch(/^SELECT * /);
        expect(ml.logs[0].values).toEqual(ids);
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

  test("with context. cache hit single id", async () => {
    const [user, contacts] = await createAllContacts();
    ml.clear();
    const loader = getNewLoader();
    const edges = await loader.load(user.id);
    verifyUserToContactRawData(user, edges, contacts.reverse());
    verifyMultiCountQueryCacheMiss([user.id]);

    ml.clear();
    const edges2 = await loader.load(user.id);
    expect(edges).toStrictEqual(edges2);

    verifyGroupedCacheHit([user.id]);
  });

  test("without context. cache hit single id", async () => {
    let [user, contacts] = await createAllContacts();
    contacts = contacts.reverse();
    ml.clear();
    const loader = getNewLoader(false);
    const edges = await loader.load(user.id);
    verifyUserToContactRawData(user, edges, contacts);
    verifyMultiCountQueryCacheMiss([user.id]);

    ml.clear();
    const edges2 = await loader.load(user.id);
    verifyUserToContactRawData(user, edges2, contacts);

    verifyMultiCountQueryCacheMiss([user.id]);
  });

  test("with context. cache miss single id", async () => {
    const id = uuidv4();
    ml.clear();
    const loader = getNewLoader();
    const edges = await loader.load(id);
    expect(edges.length).toBe(0);
    verifyMultiCountQueryCacheMiss([id]);

    ml.clear();
    const edges2 = await loader.load(id);
    expect(edges).toStrictEqual(edges2);

    verifyGroupedCacheHit([id]);
  });

  test("without context. cache miss single id", async () => {
    const id = uuidv4();
    ml.clear();
    const loader = getNewLoader(false);
    const edges = await loader.load(id);
    expect(edges.length).toBe(0);
    verifyMultiCountQueryCacheMiss([id]);

    ml.clear();
    const edges2 = await loader.load(id);
    expect(edges).toStrictEqual(edges2);

    verifyMultiCountQueryCacheMiss([id]);
  });

  test("primed object", async () => {
    const [user, contacts] = await createAllContacts();
    ml.clear();

    const loader = userToContactsDataLoaderFactory.createLoader(ctx);
    const edges = await loader.load(user.id);
    verifyUserToContactRawData(user, edges, contacts.reverse());
    verifyMultiCountQueryCacheMiss([user.id]);

    ml.clear();

    await contactLoader.createLoader(ctx).load(contacts[0].id);
    expect(ml.logs.length).toBe(1);
    expect(ml.logs[0]).toStrictEqual({
      "dataloader-cache-hit": contacts[0].id,
      "tableName": "fake_contacts",
    });
  });

  test("not-primed object", async () => {
    const [user, contacts] = await createAllContacts();
    ml.clear();

    // this loader not primed so trying to fetch object later hits the db
    const loader = getNewLoader(true);
    const edges = await loader.load(user.id);
    verifyUserToContactRawData(user, edges, contacts.reverse());
    verifyMultiCountQueryCacheMiss([user.id]);

    ml.clear();

    // fetching object hits the db since unprimed loader
    await contactLoader.createLoader(ctx).load(contacts[0].id);
    expect(ml.logs.length).toBe(1);
    expect(ml.logs[0]).toStrictEqual({
      query: buildQuery({
        tableName: "fake_contacts",
        fields: FakeContact.getFields(),
        clause: clause.In("id", [contacts[0].id]),
      }),
      values: [contacts[0].id],
    });
  });
}

interface createdData {
  m: Map<ID, FakeContact[]>;
  ids: ID[];
  users: FakeUser[];
}

async function createData(): Promise<createdData> {
  const m = new Map<ID, FakeContact[]>();
  const ids: ID[] = [];
  const users: FakeUser[] = [];

  await Promise.all(
    [1, 2, 3, 4, 5].map(async (count, idx) => {
      let [user, contacts] = await createAllContacts(undefined, count);

      m.set(user.id, contacts.reverse());
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

  // same data
  expect(edges).toStrictEqual(edges2);

  verifyPostSecondQuery(ids, slice);
}

async function testMultiQueryDataOffset(
  loaderFn: (opts: EdgeQueryableDataOptions) => Loader<ID, Data[]>,
) {
  const { m, ids, users } = await createData();

  // clear post creation
  ml.clear();

  const edges = await Promise.all(
    ids.map(async (id) => {
      const contacts = m.get(id) || [];
      const options = {
        // how an offset query works
        // we don't (currently) test greater than but it's the same thing...
        clause: clause.Less("created_at", contacts[0].createdAt.toISOString()),
        limit: 1,
      };

      const loader = loaderFn(options);
      return loader.load(id);
    }),
  );
  ml.verifyNoErrors();

  // we get one edge for each that returned (other than the one with just one row)
  for (let i = 0; i < ids.length; i++) {
    let expContacts: FakeContact[] = [];
    const user = users[i];

    if (i > 0) {
      expContacts = [(m.get(user.id) || [])[1]];
    }
    expect(
      edges[i].length,
      `count for idx ${i} for id ${ids[i]} was not as expected`,
      // 1 row returned for everything but first one
    ).toBe(expContacts.length);

    // verify the edges are as expected
    // just the one (if result exxists)
    verifyUserToContactRawData(users[i], edges[i], expContacts);
  }
  verifyMultiCountQueryOffset(ids, m);

  ml.clear();

  // reload data
  const edges2 = await Promise.all(
    ids.map(async (id) => {
      const contacts = m.get(id) || [];
      const options = {
        clause: clause.Less("created_at", contacts[0].createdAt.toISOString()),
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

function verifyGroupedData(
  ids: ID[],
  users: FakeUser[],
  edges: Data[][],
  m: Map<ID, FakeContact[]>,
  slice?: number,
) {
  for (let i = 0; i < ids.length; i++) {
    const user = users[i];
    let contacts = m.get(user.id) || [];
    if (slice) {
      contacts = contacts.slice(0, slice);
    }

    expect(
      edges[i].length,
      `count for idx ${i} for id ${ids[i]} was not as expected`,
    ).toBe(contacts.length);

    // verify the edges are as expected
    verifyUserToContactRawData(users[i], edges[i], contacts);
  }
}

function verifyGroupedCacheHit(ids: ID[]) {
  ml.verifyNoErrors();
  expect(ml.logs.length).toBe(ids.length);
  // cache hit for each id
  ml.logs.forEach((log, idx) => {
    expect(log).toStrictEqual({
      "dataloader-cache-hit": ids[idx],
      "tableName": "fake_contacts",
    });
  });
}

// manual fetch, fetch data for each id separately
function verifyMultiCountQueryCacheMiss(ids: ID[], slice?: number) {
  expect(ml.logs.length).toBe(ids.length);
  ml.logs.forEach((log, idx) => {
    const expQuery = buildQuery({
      tableName: "fake_contacts",
      fields: FakeContact.loaderOptions().fields,
      clause: clause.Eq("user_id", ids[idx]),
      orderby: "created_at DESC",
      limit: slice || DefaultLimit,
    });
    expect(log).toStrictEqual({
      query: expQuery,
      values: [ids[idx]],
    });
  });
}

function verifyMultiCountQueryOffset(ids: ID[], m: Map<ID, FakeContact[]>) {
  expect(ml.logs.length).toBe(ids.length);
  ml.logs.forEach((log, idx) => {
    let contacts = m.get(ids[idx]) || [];
    const fields = FakeContact.loaderOptions().fields;

    const cls = clause.And(
      clause.Eq("user_id", ids[idx]),
      clause.Less("created_at", contacts[0].createdAt.toISOString()),
    );

    const expQuery = buildQuery({
      tableName: "fake_contacts",
      fields: fields,
      clause: cls,
      orderby: "created_at DESC",
      limit: 1,
    });
    expect(log).toStrictEqual({
      query: expQuery,
      values: [ids[idx], contacts[0].createdAt.toISOString()],
    });
  });
}
