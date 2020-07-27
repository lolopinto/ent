import { LoggedOutViewer, IDViewer } from "./../src/viewer";
import {
  PrivacyPolicy,
  AlwaysDenyRule,
  AllowIfViewerRule,
} from "./../src/privacy";
import { ID, Ent, Data, Viewer } from "./../src/ent";
import { QueryRecorder, queryOptions } from "../src/testutils/db_mock";
import { Pool } from "pg";
import * as ent from "./../src/ent";
import { Context, ContextCache } from "../src/auth/context";
import * as query from "../src/query";
import DB from "./../src/db";
import each from "jest-each";

const loggedOutViewer = new LoggedOutViewer();

jest.mock("pg");
QueryRecorder.mockPool(Pool);

jest
  .spyOn(ent, "loadEdgeDatas")
  .mockImplementation(QueryRecorder.mockImplOfLoadEdgeDatas);

const selectOptions: ent.SelectDataOptions = {
  tableName: "table",
  fields: ["bar", "baz", "foo"],
};

class User implements Ent {
  id: ID;
  accountID: string;
  nodeType: "User";
  privacyPolicy: PrivacyPolicy = {
    rules: [AllowIfViewerRule, AlwaysDenyRule],
  };
  constructor(public viewer: Viewer, id: ID, public data: Data) {
    this.id = data["bar"];
  }

  static async load(v: Viewer, id: ID): Promise<User | null> {
    return ent.loadEnt(v, id, User.loaderOptions());
  }

  static async loadX(v: Viewer, id: ID): Promise<User> {
    return ent.loadEntX(v, id, User.loaderOptions());
  }

  static loaderOptions(): ent.LoadEntOptions<User> {
    return {
      ...selectOptions,
      ent: this,
      pkey: "bar",
    };
  }
}
let ctx: Context;

beforeEach(() => {
  ctx = getCtx();
});

interface TestCtx extends Context {
  setViewer(v: Viewer);
}
function getCtx(v?: Viewer): TestCtx {
  let viewer = v || loggedOutViewer;
  let ctx = {
    //    viewer: Viewer
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

afterEach(() => {
  QueryRecorder.clear();
  ctx.cache?.clearCache();
});

interface loadRowFn {
  (options: ent.LoadRowOptions): Promise<Data | null>;
}

interface getQueriesFn {
  (options: ent.LoadRowOptions): [queryOptions[], queryOptions[]];
}

async function loadTestRow(
  fn: loadRowFn,
  getExpQueries: getQueriesFn,
  addCtx?: boolean,
) {
  QueryRecorder.mockResult({
    tableName: selectOptions.tableName,
    clause: query.Eq("bar", 1),
    result: (values: any[]) => {
      return {
        bar: values[0],
        baz: "baz",
        foo: "foo",
      };
    },
  });

  let options: ent.LoadRowOptions = {
    ...selectOptions,
    clause: query.Eq("bar", 1),
  };
  if (addCtx) {
    options.context = ctx!;
  }

  const [expQueries1, expQueries2] = getExpQueries(options);

  const row = await fn(options);
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
  (options: ent.LoadRowOptions): Promise<Data | null>;
}

async function loadTestRows(
  fn: loadRowsFn,
  getExpQueries: getQueriesFn,
  addCtx?: boolean,
) {
  QueryRecorder.mockResult({
    tableName: selectOptions.tableName,
    clause: query.In("bar", 1, 2, 3),
    result: (values: any[]) => {
      return values.map((value) => {
        return {
          bar: value,
          baz: "baz",
          foo: "foo",
        };
      });
    },
  });

  let options: ent.LoadRowOptions = {
    ...selectOptions,
    clause: query.In("bar", 1, 2, 3),
  };
  if (addCtx) {
    options.context = ctx!;
  }

  const [expQueries1, expQueries2] = getExpQueries(options);

  const rows = await fn(options);
  QueryRecorder.validateQueryOrder(expQueries1, null);

  const rows2 = await fn(options);
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
  disableMock?: boolean,
): Promise<[User | null, User | null]> {
  if (!disableMock) {
    if (addCtx) {
      // with context, we hit a loader and it's transformed to an IN query
      QueryRecorder.mockResult({
        tableName: selectOptions.tableName,
        clause: query.In("bar", 1),
        // loader...
        result: (values: any[]) => {
          return values.map((value) => {
            return {
              bar: value,
              baz: "baz",
              foo: "foo",
            };
          });
        },
      });
    } else {
      // without context, no loader and we do a standard EQ query
      QueryRecorder.mockResult({
        tableName: selectOptions.tableName,
        clause: query.Eq("bar", 1),
        result: (values: any[]) => {
          return {
            bar: values[0],
            baz: "baz",
            foo: "foo",
          };
        },
      });
    }
  }

  const [expQueries1, expQueries2] = getExpQueries();

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

async function testLoadRow(addCtx?: boolean) {
  await loadTestRow(
    ent.loadRow,
    (options) => {
      const queryOption = {
        query: ent.buildQuery(options),
        values: options.clause.values(),
      };

      // when there's a context cache, we only run the query once so should be the same result
      if (addCtx) {
        return [[queryOption], [queryOption]];
      }
      // not cached (no context), so multiple queries made here
      return [[queryOption], [queryOption, queryOption]];
    },
    addCtx,
  );
}

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
        const expQueries = [
          {
            query: ent.buildQuery(options),
            values: options.clause.values(),
          },
        ];

        // when there's a context cache, we only run the query once
        return [expQueries, expQueries];
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
    let ctx = getCtx();
    const vc = new LoggedOutViewer(ctx);
    ctx.setViewer(vc);

    const options = {
      ...User.loaderOptions(),
      // gonna end up being a data loader...
      clause: query.In("bar", 1),
    };

    const testEnt = async (vc: Viewer) => {
      return await loadTestEnt(
        () => ent.loadEnt(vc, 1, User.loaderOptions()),
        () => {
          const expQueries = [
            {
              query: ent.buildQuery(options),
              values: options.clause.values(),
            },
          ];
          // when there's a context cache, we only run the query once so should be the same result
          return [expQueries, expQueries];
        },
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
      clause: query.Eq("bar", 1),
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
    );
  });

  test("parallel queries with context", async () => {
    QueryRecorder.mockResult({
      tableName: selectOptions.tableName,
      clause: query.In("bar", 1, 2, 3),
      // loader...
      result: (values: any[]) => {
        return values.map((value) => {
          return {
            bar: value,
            baz: "baz",
            foo: "foo",
          };
        });
      },
    });

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
      // gets coalesced into 1 IN query...
      clause: query.In("bar", 1, 2, 3),
    };
    const expQueries = [
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
    const ids = [1, 2, 3];
    ids.forEach((id) => {
      QueryRecorder.mockResult({
        tableName: selectOptions.tableName,
        clause: query.Eq("bar", id),
        // no loader
        result: (values: any[]) => {
          return {
            bar: values[0],
            baz: "baz",
            foo: "foo",
          };
        },
      });
    });

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
    const expQueries = ids.map((id) => {
      const options = {
        ...User.loaderOptions(),
        clause: query.Eq("bar", id),
      };
      return {
        query: ent.buildQuery(options),
        values: options.clause.values(),
      };
    });

    QueryRecorder.validateQueryOrder(expQueries, null);

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

    // 3 more queries for 6
    const expQueries2 = expQueries.concat(expQueries);
    QueryRecorder.validateQueryOrder(expQueries2, null);
  });
});

describe("loadEntX", () => {
  test("with context", async () => {
    const vc = getIDViewer(1);

    const options = {
      ...User.loaderOptions(),
      // context. dataloader. in query
      clause: query.In("bar", 1),
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
          return [expQueries, expQueries];
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
      clause: query.Eq("bar", 1),
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
  let clause = query.And(query.Eq("bar", 1), query.Eq("baz", "baz"));

  beforeEach(() => {
    QueryRecorder.mockResult({
      tableName: selectOptions.tableName,
      clause: clause,
      result: (values: any[]) => {
        return {
          bar: values[0],
          baz: values[1],
          foo: "foo",
        };
      },
    });
  });

  const options = {
    ...User.loaderOptions(),
    clause: clause,
  };

  test("with context", async () => {
    const vc = getIDViewer(1);

    await loadTestEnt(
      () => ent.loadEntFromClause(vc, User.loaderOptions(), clause),
      () => {
        const expQueries = [
          {
            query: ent.buildQuery(options),
            values: options.clause.values(),
          },
        ];
        // when there's a context cache, we only run the query once so should be the same result
        return [expQueries, expQueries];
      },
      true,
      true, // disableMock
    );
  });

  test("without context", async () => {
    const vc = new IDViewer(1);

    await loadTestEnt(
      () => ent.loadEntFromClause(vc, User.loaderOptions(), clause),
      () => {
        const queryOption = {
          query: ent.buildQuery(options),
          values: options.clause.values(),
        };
        const expQueries = [
          {
            query: ent.buildQuery(options),
            values: options.clause.values(),
          },
        ];
        // no context cache. so multiple queries needed
        return [[queryOption], [queryOption, queryOption]];
      },
      false,
      true, // disableMock
    );
  });

  test("loadEntXFromClause with context", async () => {
    const vc = getIDViewer(1);

    await loadTestEnt(
      () => ent.loadEntXFromClause(vc, User.loaderOptions(), clause),
      () => {
        const expQueries = [
          {
            query: ent.buildQuery(options),
            values: options.clause.values(),
          },
        ];
        // when there's a context cache, we only run the query once so should be the same result
        return [expQueries, expQueries];
      },
      true,
      true, // disableMock
    );
  });

  test("loadEntXFromClause without context", async () => {
    const vc = new IDViewer(1);

    await loadTestEnt(
      () => ent.loadEntXFromClause(vc, User.loaderOptions(), clause),
      () => {
        const queryOption = {
          query: ent.buildQuery(options),
          values: options.clause.values(),
        };
        const expQueries = [
          {
            query: ent.buildQuery(options),
            values: options.clause.values(),
          },
        ];
        // no context cache. so multiple queries needed
        return [[queryOption], [queryOption, queryOption]];
      },
      false,
      true, // disableMock
    );
  });
});

describe("loadEnts", () => {
  test("with context", async () => {
    QueryRecorder.mockResult({
      tableName: selectOptions.tableName,
      clause: query.In("bar", 1, 2, 3),
      // loader...
      result: (values: any[]) => {
        return values.map((value) => {
          return {
            bar: value,
            baz: "baz",
            foo: "foo",
          };
        });
      },
    });

    const vc = getIDViewer(1);
    const ents = await ent.loadEnts(vc, User.loaderOptions(), 1, 2, 3);

    // only loading self worked because of privacy
    expect(ents.length).toBe(1);
    expect(ents[0].id).toBe(1);

    const options = {
      ...User.loaderOptions(),
      clause: query.In("bar", 1, 2, 3),
    };
    const expQueries = [
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
    QueryRecorder.mockResult({
      tableName: selectOptions.tableName,
      clause: query.In("bar", 1, 2, 3),
      // loader...
      result: (values: any[]) => {
        return values.map((value) => {
          return {
            bar: value,
            baz: "baz",
            foo: "foo",
          };
        });
      },
    });

    const vc = new IDViewer(1);
    const ents = await ent.loadEnts(vc, User.loaderOptions(), 1, 2, 3);

    // only loading self worked because of privacy
    expect(ents.length).toBe(1);
    expect(ents[0].id).toBe(1);

    const options = {
      ...User.loaderOptions(),
      clause: query.In("bar", 1, 2, 3),
    };
    const expQueries = [
      {
        query: ent.buildQuery(options),
        values: options.clause.values(),
      },
    ];

    // only one query
    QueryRecorder.validateQueryOrder(expQueries, null);

    // add each query.Eq for the one-offs
    const ids = [1, 2, 3];
    let expQueries2 = expQueries.concat();
    ids.map((id) => {
      let clause = query.Eq("bar", id);
      let options = {
        ...User.loaderOptions(),
        clause: clause,
      };
      QueryRecorder.mockResult({
        tableName: selectOptions.tableName,
        clause: clause,
        // loader...
        result: (values: any[]) => {
          return {
            bar: id,
            baz: "baz",
            foo: "foo",
          };
        },
      });
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

    // should now have 4 queries
    QueryRecorder.validateQueryOrder(expQueries2, null);

    // reload all
    await ent.loadEnts(vc, User.loaderOptions(), 1, 2, 3);

    const expQueries3 = expQueries2.concat(expQueries);

    // a 5th in query added
    QueryRecorder.validateQueryOrder(expQueries3, null);
  });
});

describe("loadEntsFromClause", () => {
  let idResults = [1, 2, 3];
  let clause = query.Eq("baz", "baz");

  beforeEach(() => {
    QueryRecorder.mockResult({
      tableName: selectOptions.tableName,
      clause: clause,
      result: (values: any[]) => {
        return idResults.map((id) => {
          return {
            bar: id,
            baz: values[0],
            foo: "foo",
          };
        });
      },
    });
  });

  const options = {
    ...User.loaderOptions(),
    clause: clause,
  };

  test("with context", async () => {
    const vc = getIDViewer(1);

    const ents = await ent.loadEntsFromClause(vc, clause, User.loaderOptions());
    // only loading self worked because of privacy
    expect(ents.size).toBe(1);
    expect(ents.has(1)).toBe(true);

    const expQueries = [
      {
        query: ent.buildQuery(options),
        values: options.clause.values(),
      },
    ];

    // only one query
    QueryRecorder.validateQueryOrder(expQueries, null);

    const ents2 = await ent.loadEntsFromClause(
      vc,
      clause,
      User.loaderOptions(),
    );
    // only loading self worked because of privacy
    expect(ents2.size).toBe(1);
    expect(ents2.has(1)).toBe(true);

    // still only one query
    QueryRecorder.validateQueryOrder(expQueries, null);
  });

  test("without context", async () => {
    const vc = new IDViewer(1);

    const ents = await ent.loadEntsFromClause(vc, clause, User.loaderOptions());
    // only loading self worked because of privacy
    expect(ents.size).toBe(1);
    expect(ents.has(1)).toBe(true);

    const expQueries = [
      {
        query: ent.buildQuery(options),
        values: options.clause.values(),
      },
    ];

    // only one query
    QueryRecorder.validateQueryOrder(expQueries, null);

    const ents2 = await ent.loadEntsFromClause(
      vc,
      clause,
      User.loaderOptions(),
    );
    // only loading self worked because of privacy
    expect(ents2.size).toBe(1);
    expect(ents2.has(1)).toBe(true);

    // 2 queries
    QueryRecorder.validateQueryOrder(expQueries.concat(expQueries), null);
  });
});

describe("writes", () => {
  const fields = {
    bar: 1,
    baz: "baz",
    foo: "foo",
  };
  let options: ent.EditRowOptions;
  let pool = DB.getInstance().getPool();
  beforeEach(() => {
    options = {
      fields: fields,
      pkey: "bar",
      tableName: selectOptions.tableName,
      context: ctx!, // reuse "global" context
    };
  });

  const args = [
    [
      "createRow",
      async () => ent.createRow(pool, options, "RETURNING *"),
      {
        query:
          "INSERT INTO table (bar, baz, foo) VALUES ($1, $2, $3) RETURNING *",
        values: Object.values(fields),
      },
    ],
    [
      "editRow",
      async () => ent.editRow(pool, options, 1),
      {
        query:
          "UPDATE table SET bar = $1, baz = $2, foo = $3 WHERE bar = $4 RETURNING *",
        values: [...Object.values(fields), 1],
      },
    ],
    [
      "deleteRow",
      async () => ent.deleteRow(pool, options, query.Eq("bar", 1)),
      {
        query: "DELETE FROM table WHERE bar = $1",
        values: [1],
      },
    ],
  ];

  each(args).test("with context: %s", async (_name, writeFn, query) => {
    await testLoadRow(true);

    // reload. still hits same cache with one row
    await testLoadRow(true);

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
        return [
          [queryOption, query, queryOption],
          [queryOption, query, queryOption],
        ];
      },
      true,
    );
  });

  each(args).test("without context: %s", async (_name, writeFn, query) => {
    // no context, multiple queries
    await testLoadRow(false);

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
          [queryOption, queryOption, query, queryOption],
          [queryOption, queryOption, query, queryOption, queryOption],
        ];
      },
      false,
    );
  });
});
