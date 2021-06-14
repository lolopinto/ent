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
import { buildInsertQuery, buildUpdateQuery } from "./ent";
import { QueryRecorder, queryOptions } from "../testutils/db_mock";
import { createRowForTest, editRowForTest } from "../testutils/write";
import { Pool } from "pg";
import * as ent from "./ent";
import { ContextCache } from "./context";
import * as clause from "./clause";
import DB from "./db";
import each from "jest-each";
import { ObjectLoaderFactory } from "./loaders";

import { integer, table, text, setupSqlite } from "../testutils/db/test_db";
import { MockLogs } from "../testutils/mock_log";
import { clearLogLevels, setLogLevels } from "./logger";

const loggedOutViewer = new LoggedOutViewer();

const selectOptions: SelectDataOptions = {
  tableName: "users",
  fields: ["bar", "baz", "foo"],
  key: "bar",
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
const ml = new MockLogs();

beforeAll(() => {
  ml.mock();
});

afterAll(() => {
  ml.restore();
});

beforeEach(() => {
  ctx = getCtx();
  setLogLevels(["query", "error"]);
  ml.clear();
});

afterEach(() => {
  ctx.cache?.clearCache();
  clearLogLevels();
});

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
  (options: LoadRowOptions): [Data[], Data[]];
}

function validateQueries(expQueries: Data[]) {
  if (ml.logs.length !== expQueries.length) {
    console.debug(ml.logs, expQueries);
  }
  expect(ml.logs.length).toBe(expQueries.length);
  expect(ml.logs).toStrictEqual(expQueries);
}

async function createRows(fields: Data[], tableName: string): Promise<void> {
  ml.clear();
  let insertStatements: queryOptions[] = [];

  await Promise.all(
    fields.map((data) => {
      const [query, values] = buildInsertQuery({
        fields: data,
        tableName: tableName,
        fieldsToLog: data,
      });
      insertStatements.push({ query, values });
      return createRowForTest({
        fields: data,
        tableName: selectOptions.tableName,
        fieldsToLog: data,
      });
    }),
  );

  validateQueries(insertStatements);
  ml.clear();
}

async function createDefaultRow() {
  await createRows(
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
  ml.clear();

  if (!disableWrite) {
    await createDefaultRow();
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
  validateQueries(expQueries1);

  const row2 = await fn(options);
  validateQueries(expQueries2);

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
  ml.clear();

  const fields: Data[] = [1, 2, 3].map((id) => {
    return {
      bar: id,
      baz: "baz",
      foo: "foo",
    };
  });
  await createRows(fields, selectOptions.tableName);

  let options: LoadRowOptions = {
    ...selectOptions,
    clause: clause.In("bar", 1, 2, 3),
  };
  if (addCtx) {
    options.context = ctx!;
  }

  const [expQueries1, expQueries2] = getExpQueries(options);

  const rows = await fn(options);
  expect(ml.logs.length).toEqual(expQueries1.length);
  expect(ml.logs).toStrictEqual(expQueries1);

  const rows2 = await fn(options);
  expect(ml.logs.length).toEqual(expQueries2.length);
  expect(ml.logs).toStrictEqual(expQueries2);

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
  (): [Data[], Data[]];
}

async function loadTestEnt(
  fn: loadEntFn,
  getExpQueries: getEntQueriesFn,
  addCtx?: boolean,
  disableWrite?: boolean,
): Promise<[User | null, User | null]> {
  if (!disableWrite) {
    await createDefaultRow();
  }

  const [expQueries1, expQueries2] = getExpQueries();

  const ent1 = await fn();
  expect(ml.logs.length).toBe(expQueries1.length);
  expect(ml.logs).toStrictEqual(expQueries1);

  const ent2 = await fn();
  expect(ml.logs.length).toBe(expQueries2.length);
  expect(ml.logs).toStrictEqual(expQueries2);

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

async function testLoadRow(addCtx?: boolean, disableWrite?: boolean) {
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
          [queryOption],
          [
            queryOption,
            // cache hit on 2nd query
            {
              "cache-hit": "bar,baz,foo,bar=1",
              "tableName": options.tableName,
            },
          ],
        ];
      }
      // not cached (no context), so multiple queries made here
      return [[queryOption], [queryOption, queryOption]];
    },
    addCtx,
    disableWrite,
  );
}

function commonTests() {
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
          return [
            [qOption],
            [
              qOption,
              {
                // cache hit on 2nd query
                "cache-hit": "bar,baz,foo,in:bar:1,2,3",
                "tableName": options.tableName,
              },
            ],
          ];
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
      await createDefaultRow();

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
            const queryOption = {
              query: ent.buildQuery(options),
              values: options.clause.values(),
            };
            // when there's a context cache, we only run the query once so should be the same result
            const expQueries1: Data[] = [queryOption];
            const cacheHit: Data = {
              "dataloader-cache-hit": 1,
              "tableName": options.tableName,
            };
            const expQueries2: Data[] = [queryOption, cacheHit];

            // 2nd time. with different viewer. more hits
            if (vc instanceof IDViewer) {
              expQueries1.push(cacheHit, cacheHit);
              expQueries2.push(cacheHit, cacheHit);
            }
            return [expQueries1, expQueries2];
          },
          true,
          true,
        );
      };

      const [ent1, ent2] = await testEnt(vc);

      // // same context, change viewer
      const vc2 = getIDViewer(1, ctx);

      // // we still reuse the same raw-data query since it's viewer agnostic
      // // context cache works as viewer is changed
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

    beforeEach(async () => {
      const fields = [1, 2, 3].map((id) => {
        return {
          bar: id,
          baz: "baz",
          foo: "foo",
        };
      });
      await createRows(fields, selectOptions.tableName);
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
        {
          query: ent.buildQuery(options),
          values: options.clause.values(),
        },
      ];

      validateQueries(expQueries);

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

      // cache hit now
      const expQueries2 = [
        ...expQueries,
        {
          "dataloader-cache-hit": 1,
          "tableName": options.tableName,
        },
        {
          "dataloader-cache-hit": 2,
          "tableName": options.tableName,
        },
        {
          "dataloader-cache-hit": 3,
          "tableName": options.tableName,
        },
      ];
      validateQueries(expQueries2);

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

      validateQueries(expQueries);

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

      validateQueries([...expQueries, ...expQueries]);
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
            const qOption = {
              query: ent.buildQuery(options),
              values: options.clause.values(),
            };
            // when there's a context cache, we only run the query once
            // 2nd time there's a dataloader cache hit
            return [
              [qOption],
              [
                qOption,
                { "dataloader-cache-hit": 1, "tableName": options.tableName },
              ],
            ];
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
          const qOption = {
            query: ent.buildQuery(options),
            values: options.clause.values(),
          };
          // when there's a context cache, we only run the query once so should be the same result
          return [
            [qOption],
            [
              qOption,
              {
                "cache-hit": "bar,baz,foo,bar=1 AND baz=baz",
                "tableName": options.tableName,
              },
            ],
          ];
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
          const qOption = {
            query: ent.buildQuery(options),
            values: options.clause.values(),
          };
          // when there's a context cache, we only run the query once so should be the same result
          return [
            [qOption],
            [
              qOption,
              {
                "cache-hit": "bar,baz,foo,bar=1 AND baz=baz",
                "tableName": options.tableName,
              },
            ],
          ];
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
    beforeEach(async () => {
      const fields: Data[] = [1, 2, 3].map((id) => {
        return {
          bar: id,
          baz: "baz",
          foo: "foo",
        };
      });
      await createRows(fields, selectOptions.tableName);
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
        {
          query: ent.buildQuery(options),
          values: options.clause.values(),
        },
      ];

      validateQueries(expQueries);

      // reload each of these in a different place
      await Promise.all([
        ent.loadEnt(vc, 1, User.loaderOptions()),
        ent.loadEnt(vc, 2, User.loaderOptions()),
        ent.loadEnt(vc, 3, User.loaderOptions()),
      ]);

      const cacheHits = [
        {
          "dataloader-cache-hit": 1,
          "tableName": options.tableName,
        },
        {
          "dataloader-cache-hit": 2,
          "tableName": options.tableName,
        },
        {
          "dataloader-cache-hit": 3,
          "tableName": options.tableName,
        },
      ];
      const expQueries2 = [...expQueries, ...cacheHits];
      validateQueries(expQueries2);

      // reload all
      await ent.loadEnts(vc, User.loaderOptions(), 1, 2, 3);

      // more cache hits
      validateQueries([...expQueries2, ...cacheHits]);
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
      const expQueries = [inQuery];

      validateQueries(expQueries);

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
      validateQueries(expQueries2);

      // reload all
      await ent.loadEnts(vc, User.loaderOptions(), 1, 2, 3);

      const expQueries3 = expQueries2.concat(inQuery);

      // in query added again
      validateQueries(expQueries3);
    });
  });

  describe("loadEntsFromClause", () => {
    let idResults = [1, 2, 3];
    let cls: clause.Clause;
    let options, qOption: Data;

    beforeEach(async () => {
      cls = clause.Eq("baz", "baz");
      const fields: Data[] = idResults.map((id) => {
        return {
          bar: id,
          baz: "baz",
          foo: "foo",
        };
      });
      await createRows(fields, selectOptions.tableName);

      options = {
        ...User.loaderOptions(),
        clause: cls!,
      };
      qOption = {
        query: ent.buildQuery(options),
        values: options.clause.values(),
      };
    });

    test("with context", async () => {
      const vc = getIDViewer(1);

      const ents = await ent.loadEntsFromClause(vc, cls, User.loaderOptions());
      // only loading self worked because of privacy
      expect(ents.size).toBe(1);
      expect(ents.has(1)).toBe(true);

      validateQueries([qOption]);

      const ents2 = await ent.loadEntsFromClause(vc, cls, User.loaderOptions());
      // only loading self worked because of privacy
      expect(ents2.size).toBe(1);
      expect(ents2.has(1)).toBe(true);

      validateQueries([
        qOption,
        {
          "cache-hit": "bar,baz,foo,baz=baz",
          "tableName": options.tableName,
        },
      ]);
    });

    test("without context", async () => {
      const vc = new IDViewer(1);

      const ents = await ent.loadEntsFromClause(vc, cls, User.loaderOptions());
      // only loading self worked because of privacy
      expect(ents.size).toBe(1);
      expect(ents.has(1)).toBe(true);

      const expQueries = [qOption];

      validateQueries([qOption]);

      const ents2 = await ent.loadEntsFromClause(vc, cls, User.loaderOptions());
      // only loading self worked because of privacy
      expect(ents2.size).toBe(1);
      expect(ents2.has(1)).toBe(true);

      validateQueries([qOption, qOption]);
    });
  });

  describe("writes", () => {
    const fields = {
      bar: 1,
      baz: "baz",
      foo: "foo",
    };
    let options: EditRowOptions;

    beforeEach(async () => {
      options = {
        fields: fields,
        fieldsToLog: fields,
        key: "bar",
        tableName: selectOptions.tableName,
        context: ctx!, // reuse "global" context
      };

      await createDefaultRow();
    });

    const args = [
      [
        "createRow",
        // should be ent.createRow but doesn't work so changing for now
        async () => {
          // want a deep copy here...
          let options2 = options;
          options2.fields = { ...options.fields, bar: 2 };
          options2.fieldsToLog = options2.fields;
          // we need a different row so that querying after still returns one row
          return createRowForTest(options2);
        },
        () => {
          const [query, _, logValues] = buildInsertQuery({
            fields: { ...fields, bar: 2 },
            fieldsToLog: { ...fields, bar: 2 },
            tableName: selectOptions.tableName,
          });
          return { query, values: logValues };
        },
      ],
      [
        "editRow",
        // should be ent.editRow but doesn't work so changing for now
        async () => {
          // want a deep copy here...
          let options2 = options;
          options2.fields = { ...options.fields, baz: "baz3" };
          options2.fieldsToLog = options2.fields;
          // we need a different row so that querying after still returns one row
          return editRowForTest(options2, 1);
        },
        () => {
          const [query, _, logValues] = buildUpdateQuery(
            {
              fields: { ...fields, baz: "baz3" },
              fieldsToLog: { ...fields, baz: "baz3" },
              tableName: selectOptions.tableName,
              key: "bar",
            },
            1,
          );
          return { query, values: logValues };
        },
      ],
      [
        "deleteRows",
        async () => {
          // this needs to be delayed apparently
          const pool = DB.getInstance().getPool();
          return await ent.deleteRows(pool, options, clause.Eq("bar", 1));
        },
        () => {
          return {
            query: `DELETE FROM ${selectOptions.tableName} WHERE ${clause
              .Eq("bar", 1)
              .clause(1)}`,
            values: [1],
          };
        },
      ],
    ];

    const loadRowFromCache = async (addCtx: boolean) => {
      await testLoadRow(addCtx, true);
    };

    each(args).test("with context: %s", async (_name, writeFn, query) => {
      await loadRowFromCache(true);

      ml.clear();

      // performWrite
      // this clears the context cache
      await writeFn();
      if (typeof query === "function") {
        query = query();
      }
      validateQueries([query]);

      // this does additional queries
      await loadTestRow(
        ent.loadRow,
        (options) => {
          const queryOption = {
            query: ent.buildQuery(options),
            values: options.clause.values(),
          };

          const queries = [queryOption];
          let queries2: Data[] = [];
          if (query.query.startsWith("DELETE")) {
            // cache miss so we hit db again
            // TODO we should cache this in non-dataloader paths...
            queries2 = [queryOption, queryOption];
          } else {
            queries2 = [
              queryOption,
              { "cache-hit": "bar,baz,foo,bar=1", "tableName": "users" },
            ];
          }
          return [queries, queries2];
        },
        true,
        true,
      );
    });

    each(args).test("without context: %s", async (_name, writeFn, query) => {
      // no context, multiple queries
      await loadRowFromCache(false);
      ml.clear();

      // performWrite
      await writeFn();

      if (typeof query === "function") {
        query = query();
      }
      validateQueries([query]);

      // this does additional queries
      await loadTestRow(
        ent.loadRow,
        (options) => {
          const queryOption = {
            query: ent.buildQuery(options),
            values: options.clause.values(),
          };

          // no context cache so it just keeps making queries
          return [[queryOption], [queryOption, queryOption]];
        },
        false,
        true,
      );
    });
  });
}

jest.mock("pg");
QueryRecorder.mockPool(Pool);

describe("postgres", () => {
  afterEach(() => {
    QueryRecorder.clear();
  });
  commonTests();
});

describe("sqlite", () => {
  setupSqlite(`sqlite:///ent_data_test.db`, () => [
    table(
      "users",
      integer("bar", { primaryKey: true }),
      text("baz"),
      text("foo"),
    ),
  ]);

  commonTests();
});
