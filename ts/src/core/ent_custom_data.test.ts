import {
  PrivacyPolicy,
  ID,
  Ent,
  Data,
  Viewer,
  Context,
  QueryDataOptions,
  PrivacyResult,
  Allow,
  Skip,
} from "./base";
import { LoggedOutViewer, IDViewer } from "./viewer";
import { AlwaysDenyRule } from "./privacy";
import { loadCustomData, loadCustomEnts } from "./ent";
import { QueryRecorder } from "../testutils/db_mock";
import { createRowForTest } from "../testutils/write";
import { Pool } from "pg";
import { ContextCache } from "./context";
import * as clause from "./clause";

import { integer, table, text, setupSqlite } from "../testutils/db/test_db";
import { MockLogs } from "../testutils/mock_log";
import { clearLogLevels, setLogLevels } from "./logger";

jest.mock("pg");
QueryRecorder.mockPool(Pool);

let ctx: Context;
const ml = new MockLogs();

describe("postgres", () => {
  beforeAll(async () => {
    await createAllRows();
  });
  commonTests();
});

describe("sqlite", () => {
  setupSqlite(
    `sqlite:///ent_custom_data_test.db`,
    () => [
      table(
        "users",
        integer("id", { primaryKey: true }),
        text("baz"),
        text("bar"),
        text("foo"),
      ),
    ],
    {
      disableDeleteAfterEachTest: true,
    },
  );

  beforeAll(async () => {
    await createAllRows();
  });

  commonTests();
});

class User implements Ent {
  id: ID;
  accountID: string;
  nodeType = "User";
  privacyPolicy: PrivacyPolicy = {
    rules: [
      {
        async apply(v: Viewer, ent?: Ent): Promise<PrivacyResult> {
          if (!v.viewerID) {
            return Skip();
          }
          // can see each other if same modulus because we crazy
          const vNum = v.viewerID as number;
          if (vNum % 2 === (ent?.id as number) % 2) {
            return Allow();
          }
          return Skip();
        },
      },
      AlwaysDenyRule,
    ],
  };
  constructor(public viewer: Viewer, public data: Data) {
    this.id = data["id"];
  }
}

const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const reversed = [...ids].reverse();

async function createAllRows() {
  const rows = ids.map((id) => {
    const row = { id, baz: "baz" };
    if (id % 2 == 0) {
      row["bar"] = "bar2";
    } else {
      row["bar"] = "bar";
    }
    if (id % 4 == 0) {
      row["foo"] = "foo4";
    } else {
      row["foo"] = "foo";
    }
    return row;
  });
  await Promise.all(
    rows.map((row) =>
      createRowForTest({
        tableName: "users",
        fields: row,
      }),
    ),
  );
}
beforeAll(async () => {
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
const loggedOutViewer = new LoggedOutViewer();

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

const options = {
  tableName: "users",
  fields: ["*"],
  ent: User,
};
function getIDViewer(id: ID, ctx?: TestCtx) {
  if (!ctx) {
    ctx = getCtx();
  }
  let v = new IDViewer(id, { context: ctx });
  ctx.setViewer(v);
  return v;
}

function commonTests() {
  describe("loadCustomData", () => {
    test("rawQuery with context", async () => {
      await queryRawData(getCtx(undefined));
    });

    test("rawQuery without context", async () => {
      await queryRawData(undefined);
    });

    test("clause with context", async () => {
      await queryViaClause(getCtx(undefined));
    });

    test("clause without context", async () => {
      await queryViaClause(undefined);
    });

    test("options with context", async () => {
      await queryViaOptions(getCtx(undefined));
    });

    test("options without context", async () => {
      await queryViaOptions(undefined);
    });
  });

  describe("loadCustomEnts", () => {
    test("raw query", async () => {
      const v = getIDViewer(1, getCtx());

      const ents = await loadCustomEnts(
        v,
        options,
        "select * from users order by id desc",
      );
      expect(ents.length).toBe(5);
      expect(ents.map((ent) => ent.id)).toEqual([9, 7, 5, 3, 1]);
    });

    test("clause", async () => {
      const v = getIDViewer(1, getCtx());

      const ents = await loadCustomEnts(v, options, clause.Eq("bar", "bar2"));
      // not visible... all even
      expect(ents.length).toBe(0);

      // reload with different viewer and we should get data now
      const v2 = getIDViewer(2, getCtx());

      const ents2 = await loadCustomEnts(v2, options, clause.Eq("bar", "bar2"));
      expect(ents2.length).toBe(5);
      // order not actually guaranteed so this may eventually break
      expect(ents2.map((ent) => ent.id)).toEqual([2, 4, 6, 8, 10]);
    });

    test("options", async () => {
      const v = getIDViewer(1, getCtx());

      const ents = await loadCustomEnts(v, options, {
        ...options,
        clause: clause.LessEq("id", 5),
        orderby: "id desc",
      });
      expect(ents.length).toBe(3);

      // only even numbers visible
      expect(ents.map((ent) => ent.id)).toEqual([5, 3, 1]);
    });
  });

  async function queryRawData(ctx: Context | undefined) {
    const data = await loadCustomData(
      options,
      "select * from users order by id desc",
      ctx,
    );
    expect(data.length).toBe(10);
    expect(data.map((row) => row.id)).toEqual(reversed);
    expect(ml.logs.length).toBe(1);

    // re-query. hits the db
    const data2 = await loadCustomData(
      options,
      "select * from users order by id desc",
      ctx,
    );
    expect(data).toEqual(data2);
    expect(ml.logs.length).toBe(2);
  }

  async function queryViaClause(ctx: Context | undefined) {
    const data = await loadCustomData(options, clause.Greater("id", 5), ctx);
    expect(data.length).toBe(5);
    expect(data.map((row) => row.id)).toEqual(ids.slice(5, 10));
    expect(ml.logs.length).toBe(1);

    // re-query. hits the db
    const data2 = await loadCustomData(options, clause.Greater("id", 5), ctx);
    expect(data).toEqual(data2);
    expect(ml.logs.length).toBe(2);
    const lastLog = ml.logs[1];

    // if context, cache hit, otherwise, hits db
    if (ctx) {
      expect(lastLog["cache-hit"]).toBeDefined();
      expect(lastLog["query"]).toBeUndefined();
    } else {
      expect(lastLog["cache-hit"]).toBeUndefined();
      expect(lastLog["query"]).toBeDefined();
    }
  }

  async function queryViaOptions(ctx: Context | undefined) {
    const opts: QueryDataOptions = {
      clause: clause.LessEq("id", 5),
      orderby: "id desc",
    };
    const data = await loadCustomData(options, opts, ctx);

    expect(data.length).toBe(5);
    expect(data.map((row) => row.id)).toEqual(ids.slice(0, 5).reverse());
    expect(ml.logs.length).toBe(1);

    // re-query. hits the db
    const data2 = await loadCustomData(options, opts, ctx);
    expect(data).toEqual(data2);
    expect(ml.logs.length).toBe(2);
    const lastLog = ml.logs[1];

    // if context, cache hit, otherwise, hits db
    if (ctx) {
      expect(lastLog["cache-hit"]).toBeDefined();
      expect(lastLog["query"]).toBeUndefined();
    } else {
      expect(lastLog["cache-hit"]).toBeUndefined();
      expect(lastLog["query"]).toBeDefined();
    }
  }
}
