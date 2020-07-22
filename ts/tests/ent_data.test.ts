import { LoggedOutViewer } from "./../src/viewer";
import {
  PrivacyPolicy,
  AlwaysDenyRule,
  AllowIfViewerRule,
} from "./../src/privacy";
import { ID, Ent, Viewer, loadDerivedEnt, loadDerivedEntX } from "./../src/ent";
import { IDViewer } from "../src/testutils/id_viewer";
import { QueryRecorder, queryOptions } from "../src/testutils/db_mock";
import { Pool, Query } from "pg";
import * as ent from "./../src/ent";
import { ContextLite, ContextCache } from "../src/auth/context";
import * as query from "../src/query";
import ViewerResolver from "src/imports/dataz/example1/_viewer";

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
  constructor(public viewer: Viewer, public data: {}) {
    this.id = data["bar"];
  }

  static async load(v: Viewer, data: {}): Promise<User | null> {
    return loadDerivedEnt(v, data, User);
  }

  static async loadX(v: Viewer, data: {}): Promise<User> {
    return loadDerivedEntX(v, data, User);
  }

  static loaderOptions(): ent.LoadEntOptions<User> {
    return {
      ...selectOptions,
      ent: this,
      pkey: "bar",
    };
  }
}
let ctx: ContextLite;

beforeEach(() => {
  ctx = getCtx();
});

function getCtx(v?: Viewer) {
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

afterEach(() => {
  QueryRecorder.clear();
  ctx.cache?.clearCache();
});

interface loadRowFn {
  (options: ent.LoadRowOptions): Promise<{} | null>;
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
  (options: ent.LoadRowOptions): Promise<{} | null>;
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
) {
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
}

describe("loadRow", () => {
  test("with context", async () => {
    await loadTestRow(
      ent.loadRow,
      (options) => {
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
  });

  test("without context", async () => {
    await loadTestRow(ent.loadRow, (options) => {
      const queryOption = {
        query: ent.buildQuery(options),
        values: options.clause.values(),
      };
      // not cached (no context), so multiple queries made here
      return [[queryOption], [queryOption, queryOption]];
    });
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

    await loadTestEnt(
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
  });

  test("without context", async () => {
    const vc = new LoggedOutViewer();

    const options = {
      ...User.loaderOptions(),
      // gonna end up being a data loader...
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
});
