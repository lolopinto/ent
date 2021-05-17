import {
  PrivacyPolicy,
  ID,
  Ent,
  Data,
  Viewer,
  Context,
  SelectDataOptions,
  LoadEntOptions,
  LoadRowOptions,
  EditRowOptions,
} from "./base";
import { LoggedOutViewer, IDViewer } from "./viewer";
import { AlwaysDenyRule, AllowIfViewerRule } from "./privacy";
import { buildInsertQuery } from "./ent";
import { QueryRecorder, queryOptions } from "../testutils/db_mock";
import { createRowForTest, editRowForTest } from "../testutils/write";
import { Pool } from "pg";
import * as ent from "./ent";
import { ContextCache } from "./context";
import * as clause from "./clause";
import DB from "./db";
import each from "jest-each";
import { ObjectLoaderFactory } from "./loaders";

const loggedOutViewer = new LoggedOutViewer();

jest.mock("pg");
QueryRecorder.mockPool(Pool);

const selectOptions: SelectDataOptions = {
  tableName: "users",
  fields: ["bar", "baz", "foo"],
  pkey: "bar",
};
const loaderFactory = new ObjectLoaderFactory(selectOptions);

class User implements Ent {
  id: ID;
  accountID: string;
  nodeType = "User";
  privacyPolicy: PrivacyPolicy = {
    rules: [AllowIfViewerRule, AlwaysDenyRule],
  };
  constructor(public viewer: Viewer, public data: Data) {
    this.id = data["bar"];
  }

  static async load(v: Viewer, id: ID): Promise<User | null> {
    return ent.loadEnt(v, id, User.loaderOptions());
  }

  static async loadX(v: Viewer, id: ID): Promise<User> {
    return ent.loadEntX(v, id, User.loaderOptions());
  }

  static loaderOptions(): LoadEntOptions<User> {
    return {
      ...selectOptions,
      ent: this,
      loaderFactory,
    };
  }
}
let ctx: Context;

interface TestCtx extends Context {
  setViewer(v: Viewer);
}
function getCtx(v?: Viewer): TestCtx {
  let viewer = v || loggedOutViewer;
  let ctx = {
    getViewer: () => {
      return viewer;
    },
    setViewer: (v: Viewer) => {
      viewer = v;
    },
    cache: new ContextCache(),
  };
  return ctx;
}

function getIDViewer(id: ID, ctx?: TestCtx) {
  if (!ctx) {
    ctx = getCtx();
  }
  let v = new IDViewer(id, { context: ctx });
  ctx.setViewer(v);
  return v;
}

interface loadRowFn {
  (options: LoadRowOptions): Promise<Data | null>;
}

interface getQueriesFn {
  (options: LoadRowOptions): [queryOptions[], queryOptions[]];
}

async function createRows(
  fields: Data[],
  tableName: string,
): Promise<queryOptions[]> {
  let insertStatements: queryOptions[] = [];

  await Promise.all(
    fields.map((data) => {
      const [query, values] = buildInsertQuery({
        fields: data,
        tableName: tableName,
      });
      insertStatements.push({ query, values });
      return createRowForTest({
        fields: data,
        tableName: selectOptions.tableName,
      });
    }),
  );

  return insertStatements;
}

async function createDefaultRow() {
  return await createRows(
    [
      {
        bar: 1,
        baz: "baz",
        foo: "foo",
      },
    ],
    selectOptions.tableName,
  );
}

async function loadTestRow(
  fn: loadRowFn,
  getExpQueries: getQueriesFn,
  addCtx?: boolean,
  disableWrite?: boolean,
) {
  let insertStatements: queryOptions[] = [];

  if (!disableWrite) {
    insertStatements = await createDefaultRow();
  }

  let options: LoadRowOptions = {
    ...selectOptions,
    clause: clause.Eq("bar", 1),
  };
  if (addCtx) {
    options.context = ctx!;
  }

  const [expQueries1, expQueries2] = getExpQueries(options);

  const row = await fn(options);
  // add insert first
  expQueries1.unshift(...insertStatements);
  expQueries2.unshift(...insertStatements);

  QueryRecorder.validateQueryOrder(expQueries1, null);

  const row2 = await fn(options);
  QueryRecorder.validateQueryOrder(expQueries2, null);

  if (addCtx) {
    // exact same row when there's context
    expect(row).toBe(row2);
  } else {
    expect(row).toStrictEqual(row2);
  }
}

interface loadRowsFn {
  (options: LoadRowOptions): Promise<Data | null>;
}

async function loadTestRows(
  fn: loadRowsFn,
  getExpQueries: getQueriesFn,
  addCtx?: boolean,
) {
  const fields: Data[] = [1, 2, 3].map((id) => {
    return {
      bar: id,
      baz: "baz",
      foo: "foo",
    };
  });
  const insertStatements = await createRows(fields, selectOptions.tableName);

  let options: LoadRowOptions = {
    ...selectOptions,
    clause: clause.In("bar", 1, 2, 3),
  };
  if (addCtx) {
    options.context = ctx!;
  }

  const [expQueries1, expQueries2] = getExpQueries(options);

  const rows = await fn(options);
  expQueries1.unshift(...insertStatements);
  QueryRecorder.validateQueryOrder(expQueries1, null);

  const rows2 = await fn(options);
  expQueries2.unshift(...insertStatements);
  QueryRecorder.validateQueryOrder(expQueries2, null);

  if (addCtx) {
    expect(rows).toBe(rows2);
  } else {
    expect(rows).toStrictEqual(rows2);
  }
}

interface loadEntFn {
  (): Promise<User | null>;
}

interface getEntQueriesFn {
  (): [queryOptions[], queryOptions[]];
}

async function loadTestEnt(
  fn: loadEntFn,
  getExpQueries: getEntQueriesFn,
  addCtx?: boolean,
  disableWrite?: boolean,
): Promise<[User | null, User | null]> {
  let insertStatements: queryOptions[] = [];

  if (!disableWrite) {
    insertStatements = await createDefaultRow();
  }

  const [expQueries1, expQueries2] = getExpQueries();

  expQueries1.unshift(...insertStatements);
  expQueries2.unshift(...insertStatements);

  const ent1 = await fn();
  QueryRecorder.validateQueryOrder(expQueries1, ent1);

  const ent2 = await fn();
  QueryRecorder.validateQueryOrder(expQueries2, ent2);

  const row = ent1?.data;
  const row2 = ent2?.data;

  if (addCtx) {
    // exact same row when there's context
    expect(row).toBe(row2);
  } else {
    expect(row).toStrictEqual(row2);
  }

  return [ent1, ent2];
}

async function testLoadRow(
  addCtx?: boolean,
  disableWrite?: boolean,
  pre?: queryOptions[],
) {
  let pre2 = pre || [];
  await loadTestRow(
    ent.loadRow,
    (options) => {
      const queryOption = {
        query: ent.buildQuery(options),
        values: options.clause.values(),
      };

      // when there's a context cache, we only run the query once so should be the same result
      if (addCtx) {
        return [
          [...pre2, queryOption],
          [...pre2, queryOption],
        ];
      }
      // not cached (no context), so multiple queries made here
      return [
        [...pre2, queryOption],
        [...pre2, queryOption, queryOption],
      ];
    },
    addCtx,
    disableWrite,
  );
}

beforeEach(() => {
  ctx = getCtx();
});

afterEach(() => {
  QueryRecorder.clear();
  ctx.cache?.clearCache();
});

describe("loadRow", () => {
  test("with context", async () => {
    await testLoadRow(true);
  });

  test("without context", async () => {
    await testLoadRow(false);
  });
});

describe("loadRows", () => {
  test("with context", async () => {
    await loadTestRows(
      ent.loadRows,
      (options) => {
        const qOption = {
          query: ent.buildQuery(options),
          values: options.clause.values(),
        };

        // when there's a context cache, we only run the query once
        return [[qOption], [qOption]];
      },
      true,
    );
  });

  test("without context", async () => {
    await loadTestRows(ent.loadRows, (options) => {
      const queryOption = {
        query: ent.buildQuery(options),
        values: options.clause.values(),
      };

      // not cached, so multiple queries made here
      return [[queryOption], [queryOption, queryOption]];
    });
  });
});

describe("loadEnt", () => {
  test("with context", async () => {
    // write it once before all the checks since
    // repeated calls to loadTestEnt
    let insertStatements = await createDefaultRow();

    let ctx = getCtx();
    const vc = new LoggedOutViewer(ctx);
    ctx.setViewer(vc);

    const options = {
      ...User.loaderOptions(),
      // gonna end up being a data loader...
      clause: clause.In("bar", 1),
    };

    const testEnt = async (vc: Viewer) => {
      return await loadTestEnt(
        () => ent.loadEnt(vc, 1, User.loaderOptions()),
        () => {
          const expQueries = [
            ...insertStatements,
            {
              query: ent.buildQuery(options),
              values: options.clause.values(),
            },
          ];
          // when there's a context cache, we only run the query once so should be the same result
          return [expQueries, [...expQueries]];
        },
        true,
        true,
      );
    };

    const [ent1, ent2] = await testEnt(vc);

    // same context, change viewer
    const vc2 = getIDViewer(1, ctx);

    // we still reuse the same raw-data query since it's viewer agnostic
    // context cache works as viewer is changed
    const [ent3, ent4] = await testEnt(vc2);

    // no viewer, nothing loaded
    expect(ent1).toBe(null);
    expect(ent2).toBe(null);

    // viewer, same data reused and privacy respected
    expect(ent3).not.toBe(null);
    expect(ent4).not.toBe(null);

    expect(ent3?.id).toBe(1);
    expect(ent4?.id).toBe(1);
  });

  test("without context", async () => {
    const vc = new LoggedOutViewer();

    const options = {
      ...User.loaderOptions(),
      // no dataloader. simple query
      clause: clause.Eq("bar", 1),
    };

    await loadTestEnt(
      () => ent.loadEnt(vc, 1, User.loaderOptions()),
      () => {
        const queryOption = {
          query: ent.buildQuery(options),
          values: options.clause.values(),
        };
        // when there's a context cache, we only run the query once so should be the same result
        return [[queryOption], [queryOption, queryOption]];
      },
      false,
    );
  });
});

describe("loadEnt parallel queries", () => {
  // write it once before all the tests since
  // repeated calls to loadTestEnt
  let insertStatements: queryOptions[] = [];

  beforeEach(async () => {
    const fields = [1, 2, 3].map((id) => {
      return {
        bar: id,
        baz: "baz",
        foo: "foo",
      };
    });
    insertStatements = await createRows(fields, selectOptions.tableName);
  });

  test("parallel queries with context", async () => {
    const vc = getIDViewer(1);

    // 3 loadEnts at the same time
    const [ent1, ent2, ent3] = await Promise.all([
      ent.loadEnt(vc, 1, User.loaderOptions()),
      ent.loadEnt(vc, 2, User.loaderOptions()),
      ent.loadEnt(vc, 3, User.loaderOptions()),
    ]);

    // only 1 ent visible
    expect(ent1).not.toBe(null);
    expect(ent2).toBe(null);
    expect(ent3).toBe(null);

    const options = {
      ...User.loaderOptions(),
      // gets coalesced into 1 IN clause...
      clause: clause.In("bar", 1, 2, 3),
    };
    const expQueries = [
      ...insertStatements,
      {
        query: ent.buildQuery(options),
        values: options.clause.values(),
      },
    ];

    // only one query
    QueryRecorder.validateQueryOrder(expQueries, null);

    // load the data again
    // everything should still be in cache
    const [ent4, ent5, ent6] = await Promise.all([
      ent.loadEnt(vc, 1, User.loaderOptions()),
      ent.loadEnt(vc, 2, User.loaderOptions()),
      ent.loadEnt(vc, 3, User.loaderOptions()),
    ]);

    // only 1 ent visible (same as before)
    expect(ent4).not.toBe(null);
    expect(ent5).toBe(null);
    expect(ent6).toBe(null);

    // still only that same query
    QueryRecorder.validateQueryOrder(expQueries, null);

    // exact same row.
    expect(ent1?.data).toBe(ent4?.data);
  });

  test("parallel queries without context", async () => {
    const vc = new IDViewer(1);

    // 3 loadEnts at the same time
    const [ent1, ent2, ent3] = await Promise.all([
      ent.loadEnt(vc, 1, User.loaderOptions()),
      ent.loadEnt(vc, 2, User.loaderOptions()),
      ent.loadEnt(vc, 3, User.loaderOptions()),
    ]);

    // only 1 ent visible
    expect(ent1).not.toBe(null);
    expect(ent2).toBe(null);
    expect(ent3).toBe(null);

    // a different query sent for each id so ending up with 3
    let expQueries: queryOptions[] = [1, 2, 3].map((id) => {
      const options = {
        ...User.loaderOptions(),
        clause: clause.Eq("bar", id),
      };
      return {
        query: ent.buildQuery(options),
        values: options.clause.values(),
      };
    });

    QueryRecorder.validateQueryOrder(
      [...insertStatements, ...expQueries],
      null,
    );

    // load the data again
    const [ent4, ent5, ent6] = await Promise.all([
      ent.loadEnt(vc, 1, User.loaderOptions()),
      ent.loadEnt(vc, 2, User.loaderOptions()),
      ent.loadEnt(vc, 3, User.loaderOptions()),
    ]);

    // only 1 ent visible (same as before)
    expect(ent4).not.toBe(null);
    expect(ent5).toBe(null);
    expect(ent6).toBe(null);

    // 3 more queries for 9
    QueryRecorder.validateQueryOrder(
      [...insertStatements, ...expQueries, ...expQueries],
      null,
    );
  });
});

describe("loadEntX", () => {
  test("with context", async () => {
    const vc = getIDViewer(1);

    const options = {
      ...User.loaderOptions(),
      // context. dataloader. in query
      clause: clause.In("bar", 1),
    };

    const testEnt = async (vc: Viewer) => {
      return await loadTestEnt(
        () => ent.loadEntX(vc, 1, User.loaderOptions()),
        () => {
          const expQueries = [
            {
              query: ent.buildQuery(options),
              values: options.clause.values(),
            },
          ];
          // when there's a context cache, we only run the query once so should be the same result
          // need to clone 2nd one
          return [expQueries, [...expQueries]];
        },
        true,
      );
    };

    const [ent1, ent2] = await testEnt(vc);

    expect(ent1).not.toBe(null);
    expect(ent2).not.toBe(null);

    expect(ent1?.id).toBe(1);
    expect(ent2?.id).toBe(1);
  });

  test("without context", async () => {
    const vc = new IDViewer(1);

    const options = {
      ...User.loaderOptions(),
      // no context, simple query
      clause: clause.Eq("bar", 1),
    };

    await loadTestEnt(
      () => ent.loadEntX(vc, 1, User.loaderOptions()),
      () => {
        const queryOption = {
          query: ent.buildQuery(options),
          values: options.clause.values(),
        };
        // when there's a context cache, we only run the query once so should be the same result
        return [[queryOption], [queryOption, queryOption]];
      },
    );
  });
});

describe("loadEnt(X)FromClause", () => {
  let cls = clause.And(clause.Eq("bar", 1), clause.Eq("baz", "baz"));

  const options = {
    ...User.loaderOptions(),
    clause: cls,
  };

  test("with context", async () => {
    const vc = getIDViewer(1);

    await loadTestEnt(
      () => ent.loadEntFromClause(vc, User.loaderOptions(), cls),
      () => {
        const expQueries = [
          {
            query: ent.buildQuery(options),
            values: options.clause.values(),
          },
        ];
        // when there's a context cache, we only run the query once so should be the same result
        return [expQueries, [...expQueries]];
      },
      true,
    );
  });

  test("without context", async () => {
    const vc = new IDViewer(1);

    await loadTestEnt(
      () => ent.loadEntFromClause(vc, User.loaderOptions(), cls),
      () => {
        const queryOption = {
          query: ent.buildQuery(options),
          values: options.clause.values(),
        };
        // no context cache. so multiple queries needed
        return [[queryOption], [queryOption, queryOption]];
      },
      false,
    );
  });

  test("loadEntXFromClause with context", async () => {
    const vc = getIDViewer(1);

    await loadTestEnt(
      () => ent.loadEntXFromClause(vc, User.loaderOptions(), cls),
      () => {
        const expQueries = [
          {
            query: ent.buildQuery(options),
            values: options.clause.values(),
          },
        ];
        // when there's a context cache, we only run the query once so should be the same result
        return [expQueries, [...expQueries]];
      },
      true,
    );
  });

  test("loadEntXFromClause without context", async () => {
    const vc = new IDViewer(1);

    await loadTestEnt(
      () => ent.loadEntXFromClause(vc, User.loaderOptions(), cls),
      () => {
        const queryOption = {
          query: ent.buildQuery(options),
          values: options.clause.values(),
        };
        // no context cache. so multiple queries needed
        return [[queryOption], [queryOption, queryOption]];
      },
      false,
    );
  });
});

describe("loadEnts", () => {
  let insertStatements: queryOptions[] = [];
  beforeEach(async () => {
    const fields: Data[] = [1, 2, 3].map((id) => {
      return {
        bar: id,
        baz: "baz",
        foo: "foo",
      };
    });
    insertStatements = await createRows(fields, selectOptions.tableName);
  });

  test("with context", async () => {
    const vc = getIDViewer(1);
    const ents = await ent.loadEnts(vc, User.loaderOptions(), 1, 2, 3);

    // only loading self worked because of privacy
    expect(ents.length).toBe(1);
    expect(ents[0].id).toBe(1);

    const options = {
      ...User.loaderOptions(),
      clause: clause.In("bar", 1, 2, 3),
    };
    const expQueries = [
      ...insertStatements,
      {
        query: ent.buildQuery(options),
        values: options.clause.values(),
      },
    ];

    // only one query
    QueryRecorder.validateQueryOrder(expQueries, null);

    // reload each of these in a different place
    await Promise.all([
      ent.loadEnt(vc, 1, User.loaderOptions()),
      ent.loadEnt(vc, 2, User.loaderOptions()),
      ent.loadEnt(vc, 3, User.loaderOptions()),
    ]);

    // still the same one query
    QueryRecorder.validateQueryOrder(expQueries, null);

    // reload all
    await ent.loadEnts(vc, User.loaderOptions(), 1, 2, 3);

    // still the same one query
    QueryRecorder.validateQueryOrder(expQueries, null);
  });

  test("without context", async () => {
    const vc = new IDViewer(1);
    const ents = await ent.loadEnts(vc, User.loaderOptions(), 1, 2, 3);

    // only loading self worked because of privacy
    expect(ents.length).toBe(1);
    expect(ents[0].id).toBe(1);

    const options = {
      ...User.loaderOptions(),
      clause: clause.In("bar", 1, 2, 3),
    };
    const inQuery = {
      query: ent.buildQuery(options),
      values: options.clause.values(),
    };
    const expQueries = [...insertStatements, inQuery];

    // the insert + in queries
    QueryRecorder.validateQueryOrder(expQueries, null);

    // add each clause.Eq for the one-offs
    const ids = [1, 2, 3];
    let expQueries2 = expQueries.concat();
    ids.map((id) => {
      let cls = clause.Eq("bar", id);
      let options = {
        ...User.loaderOptions(),
        clause: cls,
      };
      expQueries2.push({
        query: ent.buildQuery(options),
        values: options.clause.values(),
      });
    });

    // reload each of these in a different place
    await Promise.all([
      ent.loadEnt(vc, 1, User.loaderOptions()),
      ent.loadEnt(vc, 2, User.loaderOptions()),
      ent.loadEnt(vc, 3, User.loaderOptions()),
    ]);

    // should now have 3 more queries
    QueryRecorder.validateQueryOrder(expQueries2, null);

    // reload all
    await ent.loadEnts(vc, User.loaderOptions(), 1, 2, 3);

    const expQueries3 = expQueries2.concat(inQuery);

    // in query added again
    QueryRecorder.validateQueryOrder(expQueries3, null);
  });
});

describe("loadEntsFromClause", () => {
  let idResults = [1, 2, 3];
  let cls = clause.Eq("baz", "baz");

  let insertStatements: queryOptions[] = [];

  beforeEach(async () => {
    const fields: Data[] = idResults.map((id) => {
      return {
        bar: id,
        baz: "baz",
        foo: "foo",
      };
    });
    insertStatements = await createRows(fields, selectOptions.tableName);
  });

  const options = {
    ...User.loaderOptions(),
    clause: cls,
  };
  const qOption = {
    query: ent.buildQuery(options),
    values: options.clause.values(),
  };

  test("with context", async () => {
    const vc = getIDViewer(1);

    const ents = await ent.loadEntsFromClause(vc, cls, User.loaderOptions());
    // only loading self worked because of privacy
    expect(ents.size).toBe(1);
    expect(ents.has(1)).toBe(true);

    const expQueries = [...insertStatements, qOption];

    // insert statemetns +  query
    QueryRecorder.validateQueryOrder(expQueries, null);

    const ents2 = await ent.loadEntsFromClause(vc, cls, User.loaderOptions());
    // only loading self worked because of privacy
    expect(ents2.size).toBe(1);
    expect(ents2.has(1)).toBe(true);

    // still same
    QueryRecorder.validateQueryOrder(expQueries, null);
  });

  test("without context", async () => {
    const vc = new IDViewer(1);

    const ents = await ent.loadEntsFromClause(vc, cls, User.loaderOptions());
    // only loading self worked because of privacy
    expect(ents.size).toBe(1);
    expect(ents.has(1)).toBe(true);

    const expQueries = [...insertStatements, qOption];

    // expected queries
    QueryRecorder.validateQueryOrder(expQueries, null);

    const ents2 = await ent.loadEntsFromClause(vc, cls, User.loaderOptions());
    // only loading self worked because of privacy
    expect(ents2.size).toBe(1);
    expect(ents2.has(1)).toBe(true);

    // extra query
    QueryRecorder.validateQueryOrder(expQueries.concat(qOption), null);
  });
});

describe("writes", () => {
  const fields = {
    bar: 1,
    baz: "baz",
    foo: "foo",
  };
  let options: EditRowOptions;
  let pool = DB.getInstance().getPool();
  let insertStatements: queryOptions[] = [];

  beforeEach(async () => {
    options = {
      fields: fields,
      pkey: "bar",
      tableName: selectOptions.tableName,
      context: ctx!, // reuse "global" context
    };

    insertStatements = await createDefaultRow();
  });

  const args = [
    [
      "createRow",
      // should be ent.createRow but doesn't work so changing for now
      async () => {
        // want a deep copy here...
        let options2 = options;
        options2.fields = { ...options.fields };
        options2.fields.bar = 2;
        // we need a different row so that querying after still returns one row
        return createRowForTest(options2);
      },
      {
        query: `INSERT INTO ${selectOptions.tableName} (bar, baz, foo) VALUES ($1, $2, $3)`,
        values: [2, "baz", "foo"],
      },
    ],
    [
      "editRow",
      // should be ent.editRow but doesn't work so changing for now
      async () => editRowForTest(options, 1),
      {
        query: `UPDATE ${selectOptions.tableName} SET bar = $1, baz = $2, foo = $3 WHERE bar = $4`,
        values: [...Object.values(fields), 1],
      },
    ],
    [
      "deleteRows",
      async () => ent.deleteRows(pool, options, clause.Eq("bar", 1)),
      {
        query: `DELETE FROM ${selectOptions.tableName} WHERE bar = $1`,
        values: [1],
      },
    ],
  ];

  const loadRowFromCache = async (addCtx: boolean) => {
    await testLoadRow(addCtx, true, insertStatements);
  };

  each(args).test("with context: %s", async (_name, writeFn, query) => {
    await loadRowFromCache(true);

    // reload. still hits same cache with one row
    await loadRowFromCache(true);

    // performWrite
    // this clears the context cache
    await writeFn();

    // this does additional queries
    await loadTestRow(
      ent.loadRow,
      (options) => {
        const queryOption = {
          query: ent.buildQuery(options),
          values: options.clause.values(),
        };

        // since we cleared the cache, this will now show an additional read query

        const queries = [...insertStatements, queryOption, query, queryOption];
        let queries2 = [...queries];
        if (query.query.startsWith("DELETE")) {
          queries2.push(queries2[queries2.length - 1]);
        }
        return [
          queries,
          queries2,
          // [...insertStatements, queryOption, query, queryOption],
          // // no data so we query again!
          // [...insertStatements, queryOption, query, queryOption, queryOption],
        ];
      },
      true,
      true,
    );
  });

  each(args).test("without context: %s", async (_name, writeFn, query) => {
    // no context, multiple queries
    await loadRowFromCache(false);

    // performWrite
    await writeFn();

    // this does additional queries
    await loadTestRow(
      ent.loadRow,
      (options) => {
        const queryOption = {
          query: ent.buildQuery(options),
          values: options.clause.values(),
        };

        // no context cache so it just keeps making queries
        return [
          [...insertStatements, queryOption, queryOption, query, queryOption],
          [
            ...insertStatements,
            queryOption,
            queryOption,
            query,
            queryOption,
            queryOption,
          ],
        ];
      },
      false,
      true,
    );
  });
});
