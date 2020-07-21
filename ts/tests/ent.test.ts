import { LoggedOutViewer } from "./../src/viewer";
import {
  PrivacyPolicy,
  AlwaysDenyRule,
  AllowIfViewerRule,
} from "./../src/privacy";
import { ID, Ent, Viewer, loadDerivedEnt, loadDerivedEntX } from "./../src/ent";
import { IDViewer } from "../src/testutils/id_viewer";
import { QueryRecorder } from "../src/testutils/db_mock";
import { Pool, Query } from "pg";
import * as ent from "./../src/ent";
import { ContextLite, ContextCache } from "../src/auth/context";
import * as query from "../src/query";

const loggedOutViewer = new LoggedOutViewer();

class User implements Ent {
  id: ID;
  accountID: string;
  nodeType: "User";
  privacyPolicy: PrivacyPolicy = {
    rules: [AllowIfViewerRule, AlwaysDenyRule],
  };
  constructor(public viewer: Viewer, data: {}) {
    this.id = data["id"];
  }

  static async load(v: Viewer, data: {}): Promise<User | null> {
    return loadDerivedEnt(v, data, User);
  }

  static async loadX(v: Viewer, data: {}): Promise<User> {
    return loadDerivedEntX(v, data, User);
  }
}

describe("loadEnt", () => {
  test("loggedout", async () => {
    const user = await User.load(loggedOutViewer, { id: "1" });
    expect(user).toBe(null);
  });

  test("id viewer", async () => {
    const user = await User.load(new IDViewer("1"), { id: "1" });
    expect(user).not.toBe(null);
    expect(user?.id).toBe("1");
  });
});

describe("loadEntX", () => {
  test("loggedout", async () => {
    try {
      await User.loadX(loggedOutViewer, { id: "1" });
      fail("should not have gotten here");
    } catch (e) {}
  });

  test("id viewer", async () => {
    try {
      const user = await User.loadX(new IDViewer("1"), { id: "1" });
      expect(user.id).toBe("1");
    } catch (e) {
      fail(e.message);
    }
  });
});

jest.mock("pg");
QueryRecorder.mockPool(Pool);

jest
  .spyOn(ent, "loadEdgeDatas")
  .mockImplementation(QueryRecorder.mockImplOfLoadEdgeDatas);

let ctx: ContextLite;

beforeEach(() => {
  ctx = {
    getViewer: () => {
      return new LoggedOutViewer();
    },
    cache: new ContextCache(),
  };
});

function getCtx() {
  return ctx!;
}

afterEach(() => {
  QueryRecorder.clear();
  ctx.cache?.clearCache();
});

const selectOptions: ent.SelectDataOptions = {
  tableName: "table",
  fields: ["bar", "baz", "foo"],
};

test("load row with context", async () => {
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

  const options = {
    ...selectOptions,
    context: getCtx(),
    clause: query.Eq("bar", 1),
  };

  const expQueries = [
    {
      query: ent.buildQuery(options),
      values: options.clause.values(),
    },
  ];

  // when there's a context cache, we only run the query once
  const row = await ent.loadRow(options);
  QueryRecorder.validateQueryOrder(expQueries, null);

  const row2 = await ent.loadRow(options);
  QueryRecorder.validateQueryOrder(expQueries, null);

  expect(row).toBe(row2);
});

test("load row without context", async () => {
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

  const options = {
    ...selectOptions,
    clause: query.Eq("bar", 1),
  };

  const queryOption = {
    query: ent.buildQuery(options),
    values: options.clause.values(),
  };

  const row = await ent.loadRow(options);
  QueryRecorder.validateQueryOrder([queryOption], null);

  const row2 = await ent.loadRow(options);

  // not cached (no context), so multiple queries made here
  QueryRecorder.validateQueryOrder([queryOption, queryOption], null);

  expect(row).toStrictEqual(row2);
});

test.only("load rows with context", async () => {
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

  const options = {
    ...selectOptions,
    context: getCtx(),
    clause: query.In("bar", 1, 2, 3),
  };

  const expQueries = [
    {
      query: ent.buildQuery(options),
      values: options.clause.values(),
    },
  ];

  // when there's a context cache, we only run the query once
  const rows = await ent.loadRows(options);
  QueryRecorder.validateQueryOrder(expQueries, null);

  const rows2 = await ent.loadRows(options);
  QueryRecorder.validateQueryOrder(expQueries, null);

  expect(rows).toBe(rows2);
});

test.only("load rows without context", async () => {
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

  const options = {
    ...selectOptions,
    clause: query.In("bar", 1, 2, 3),
  };

  const queryOption = {
    query: ent.buildQuery(options),
    values: options.clause.values(),
  };

  const rows = await ent.loadRows(options);
  QueryRecorder.validateQueryOrder([queryOption], null);

  const rows2 = await ent.loadRows(options);

  // not cached, so multiple queries made here
  QueryRecorder.validateQueryOrder([queryOption, queryOption], null);

  expect(rows).toStrictEqual(rows2);
});
