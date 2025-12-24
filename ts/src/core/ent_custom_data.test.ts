import {
  PrivacyPolicy,
  ID,
  Ent,
  Viewer,
  Context,
  QueryDataOptions,
  PrivacyResult,
  Allow,
  Skip,
  LoadCustomEntOptions,
} from "./base.js";
import { LoggedOutViewer, IDViewer } from "./viewer.js";
import { AlwaysDenyRule } from "./privacy.js";
import {
  loadCustomCount,
  loadCustomData,
  loadCustomEnts,
  loadEnt,
  loadEnts,
} from "./ent.js";
import { createRowForTest, editRowForTest } from "../testutils/write.js";
import { ContextCache } from "./context.js";
import * as clause from "./clause.js";

import {
  integer,
  table,
  text,
  setupSqlite,
  timestamp,
  TempDB,
} from "../testutils/db/temp_db.js";
import { MockLogs } from "../testutils/mock_log.js";
import { clearLogLevels, setLogLevels } from "./logger.js";
import DB, { Dialect } from "./db.js";
import { ObjectLoaderFactory } from "./loaders/index.js";
import { CustomEdgeQueryBase } from "./query/index.js";
import { BaseEnt } from "../testutils/builder.js";
import { OrderBy } from "./query_impl.js";

let ctx: Context;
const ml = new MockLogs();

class User extends BaseEnt {
  accountID: string;
  nodeType = "User";
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return {
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
  }
}

interface DataRow {
  id: number;
  foo: string;
  bar: string;
  baz: string;
  qux: string | null;
}

interface QueryDataRow extends DataRow {
  created_at: Date;
}

const options: LoadCustomEntOptions<User, Viewer, DataRow> = {
  tableName: "users",
  fields: ["*"],
  ent: User,
  loaderFactory: new ObjectLoaderFactory({
    tableName: "users",
    fields: ["*"],
    key: "id",
  }),
};

const softDeleteOptions: LoadCustomEntOptions<User, Viewer, DataRow> = {
  tableName: "users",
  fields: ["*"],
  ent: User,
  loaderFactory: new ObjectLoaderFactory({
    tableName: "users",
    fields: ["*"],
    key: "id",
    clause: clause.Eq("deleted_at", null),
    instanceKey: "loader-factory-deleted-at",
  }),
};

const getTable = (softDelete = false) => {
  const cols = [
    integer("id", { primaryKey: true }),
    text("baz"),
    text("bar"),
    text("foo"),
    text("qux", { nullable: true }),
    timestamp("created_at", { default: "now()" }),
  ];
  if (softDelete) {
    cols.push(timestamp("deleted_at", { nullable: true }));
  }
  return table("users", ...cols);
};

function setupPostgresTables(tdb: TempDB, softDelete = false) {
  beforeAll(async () => {
    await tdb.create(getTable(softDelete));
  });

  afterAll(async () => {
    await tdb.dropAll();
  });

  beforeEach(async () => {
    await createAllRows();
    ml.clear();
  });

  afterEach(async () => {
    await DB.getInstance().getPool().query("DELETE FROM users");
  });
}

describe("postgres", () => {
  const tdb = new TempDB(Dialect.Postgres);

  beforeAll(async () => {
    await tdb.beforeAll();
  });

  afterAll(async () => {
    await tdb.afterAll();
  });

  describe("postgres no soft delete", () => {
    setupPostgresTables(tdb);
    commonTests(options);
  });

  describe("postgres with soft delete", () => {
    setupPostgresTables(tdb, true);
    commonTests(softDeleteOptions);
    softDeleteTests(softDeleteOptions);
    mixTests();
  });
});

describe("sqlite no soft delete", () => {
  setupSqlite(`sqlite:///ent_custom_data_test.db`, () => [
    table(
      "users",
      integer("id", { primaryKey: true }),
      text("baz"),
      text("bar"),
      text("foo"),
      text("qux", { nullable: true }),
      timestamp("created_at", { default: new Date().toISOString() }),
    ),
  ]);

  beforeEach(async () => {
    await createAllRows();
    ml.clear();
  });

  commonTests(options);
});

describe("sqlite with soft delete", () => {
  setupSqlite(`sqlite:///ent_custom_data_soft_deletetest.db`, () => [
    table(
      "users",
      integer("id", { primaryKey: true }),
      text("baz"),
      text("bar"),
      text("foo"),
      text("qux", { nullable: true }),
      timestamp("created_at", { default: new Date().toISOString() }),
      timestamp("deleted_at", { nullable: true }),
    ),
  ]);

  beforeEach(async () => {
    await createAllRows();
    ml.clear();
  });

  commonTests(softDeleteOptions);
  softDeleteTests(softDeleteOptions);
  mixTests();
});

const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const even = [2, 4, 6, 8, 10];
const softDeleteIds = [7, 8, 9, 10];
const reversed = [...ids].reverse();

async function createAllRows(addDeletedAt = false) {
  const rows = ids.map((id) => {
    const row = { id, baz: "baz" };
    if (id % 2 == 0) {
      row["bar"] = "bar2";
      row["qux"] = null;
    } else {
      row["bar"] = "bar";
      row["qux"] = `qux${id}`;
    }
    if (id % 4 == 0) {
      row["foo"] = "foo4";
    } else {
      row["foo"] = "foo";
    }
    if (addDeletedAt) {
      row["deleted_at"] = null;
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
  setLogLevels(["query", "error", "cache"]);
  ml.clear();
});

afterEach(() => {
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

function getIDViewer(id: ID, ctx?: TestCtx) {
  if (!ctx) {
    ctx = getCtx();
  }
  let v = new IDViewer(id, { context: ctx });
  ctx.setViewer(v);
  return v;
}

async function softDelete(ids: number[]) {
  for (const id of ids) {
    await editRowForTest({
      tableName: "users",
      fields: {
        deleted_at: new Date(),
      },
      whereClause: clause.Eq("id", id),
    });
  }
}
async function queryViaSQLQuery(
  opts: LoadCustomEntOptions<User>,
  ctx: Context | undefined,
) {
  const data = await loadCustomData(
    opts,
    "select * from users order by id desc",
    ctx,
  );
  expect(data.length).toBe(ids.length);
  expect(data.map((row) => row.id)).toEqual(reversed);
  expect(ml.logs.length).toBe(1);

  // re-query. hits the db
  const data2 = await loadCustomData(
    opts,
    "select * from users order by id desc",
    ctx,
  );
  expect(data).toEqual(data2);
  expect(ml.logs.length).toBe(2);
}

async function queryCountViaSQLQuery(
  opts: LoadCustomEntOptions<User>,
  ctx: Context | undefined,
) {
  const count = await loadCustomCount(
    opts,
    "select count(*) as count from users",
    ctx,
  );
  expect(count).toBe(ids.length);
  expect(ml.logs.length).toBe(1);

  // re-query. hits the db
  const count2 = await loadCustomCount(
    opts,
    "select count(*) as count from users",
    ctx,
  );
  expect(count).toEqual(count2);
  expect(ml.logs.length).toBe(2);
}

async function querySoftDeleteViaSQLQuery(
  opts: LoadCustomEntOptions<User>,
  ctx: Context | undefined,
) {
  const data = await loadCustomData(
    opts,
    "select * from users where deleted_at IS NOT NULL order by id desc",
    ctx,
  );
  expect(data.length).toBe(softDeleteIds.length);
  expect(ml.logs.length).toBe(1);

  // re-query. hits the db
  const data2 = await loadCustomData(
    opts,
    "select * from users where deleted_at IS NOT NULL order by id desc",
    ctx,
  );
  expect(data).toEqual(data2);
  expect(ml.logs.length).toBe(2);
}

async function queryViaParameterizedQuery(
  opts: LoadCustomEntOptions<User>,
  ctx: Context | undefined,
) {
  const dialect = DB.getDialect();
  const data = await loadCustomData(
    opts,
    {
      query: `select * from users where id < ${
        dialect === Dialect.Postgres ? "$1" : "?"
      } order by id desc`,
      values: [5],
    },
    ctx,
  );
  expect(data.length).toBe(4);
  expect(data.map((row) => row.id)).toEqual(reversed.slice(6));
  expect(ml.logs.length).toBe(1);

  // re-query. hits the db
  const data2 = await loadCustomData(
    opts,
    {
      query: `select * from users where id < ${
        dialect === Dialect.Postgres ? "$1" : "?"
      } order by id desc`,
      values: [5],
    },
    ctx,
  );
  expect(data).toEqual(data2);
  expect(ml.logs.length).toBe(2);
}

async function queryCountViaParameterizedQuery(
  opts: LoadCustomEntOptions<User>,
  ctx: Context | undefined,
) {
  const dialect = DB.getDialect();
  const count = await loadCustomCount(
    opts,
    {
      query: `select count(*) as count from users where id < ${
        dialect === Dialect.Postgres ? "$1" : "?"
      }`,
      values: [5],
    },
    ctx,
  );
  expect(count).toBe(4);
  expect(ml.logs.length).toBe(1);

  // re-query. hits the db
  const count2 = await loadCustomCount(
    opts,
    {
      query: `select count(*) as count from users where id < ${
        dialect === Dialect.Postgres ? "$1" : "?"
      }`,
      values: [5],
    },
    ctx,
  );
  expect(count).toEqual(count2);
  expect(ml.logs.length).toBe(2);
}

async function querySoftDeleteCountViaParameterizedQuery(
  opts: LoadCustomEntOptions<User>,
  ctx: Context | undefined,
) {
  const dialect = DB.getDialect();
  const count = await loadCustomCount(
    opts,
    {
      query: `select count(*) as count from users where deleted_at IS NOT NULL AND id > ${
        dialect === Dialect.Postgres ? "$1" : "?"
      }`,
      values: [9],
    },
    ctx,
  );
  expect(count).toBe(1);
  expect(ml.logs.length).toBe(1);

  // re-query. hits the db
  const count2 = await loadCustomCount(
    opts,
    {
      query: `select count(*) as count from users where deleted_at IS NOT NULL AND id > ${
        dialect === Dialect.Postgres ? "$1" : "?"
      }`,
      values: [9],
    },
    ctx,
  );
  expect(count).toEqual(count2);
  expect(ml.logs.length).toBe(2);
}

async function querySoftDeleteViaParameterizedQuery(
  opts: LoadCustomEntOptions<User>,
  ctx: Context | undefined,
) {
  const dialect = DB.getDialect();
  const data = await loadCustomData(
    opts,
    {
      query: `select * from users where deleted_at IS NOT NULL AND id > ${
        dialect === Dialect.Postgres ? "$1" : "?"
      } order by id desc`,
      values: [9],
    },
    ctx,
  );
  expect(data.length).toBe(1);
  expect(ml.logs.length).toBe(1);

  // re-query. hits the db
  const data2 = await loadCustomData(
    opts,
    {
      query: `select * from users where deleted_at IS NOT NULL AND id > ${
        dialect === Dialect.Postgres ? "$1" : "?"
      } order by id desc`,
      values: [9],
    },
    ctx,
  );
  expect(data).toEqual(data2);
  expect(ml.logs.length).toBe(2);
}

async function queryViaClause(
  opts: LoadCustomEntOptions<User>,
  ctx: Context | undefined,
  expIds?: number[],
) {
  const data = await loadCustomData(opts, clause.Greater("id", 5), ctx);
  expect(data.length).toBe(expIds?.length || 5);
  expect(data.map((row) => row.id).sort()).toEqual(
    (expIds || ids.slice(5, 10)).sort(),
  );
  expect(ml.logs.length).toBe(1);

  // re-query. hits the db
  const data2 = await loadCustomData(opts, clause.Greater("id", 5), ctx);
  expect(data).toEqual(data2);
  expect(ml.logs.length).toBe(2);
  const lastLog = ml.logs[1];

  // if context, cache hit, otherwise, hits db
  if (ctx) {
    expect(lastLog["dataloader-cache-hit"]).toBeDefined();
    expect(lastLog["query"]).toBeUndefined();
  } else {
    expect(lastLog["cache-hit"]).toBeUndefined();
    expect(lastLog["query"]).toBeDefined();
  }
}

async function queryViaClausePlusDeletedAt(
  opts: LoadCustomEntOptions<User>,
  ctx: Context | undefined,
  expIds?: number[],
) {
  const data = await loadCustomData(
    opts,
    clause.And(clause.Greater("id", 5), clause.NotEq("deleted_at", null)),
    ctx,
  );
  expect(data.length).toBe(expIds?.length || 5);
  expect(data.map((row) => row.id).sort()).toEqual(
    (expIds || ids.slice(5, 10)).sort(),
  );
  expect(ml.logs.length).toBe(1);

  // re-query. hits the db
  const data2 = await loadCustomData(
    opts,
    clause.And(clause.Greater("id", 5), clause.NotEq("deleted_at", null)),
    ctx,
  );
  expect(data).toEqual(data2);
  expect(ml.logs.length).toBe(2);
  const lastLog = ml.logs[1];

  // if context, cache hit, otherwise, hits db
  if (ctx) {
    expect(lastLog["dataloader-cache-hit"]).toBeDefined();
    expect(lastLog["query"]).toBeUndefined();
  } else {
    expect(lastLog["cache-hit"]).toBeUndefined();
    expect(lastLog["query"]).toBeDefined();
  }
}

async function queryCountViaClause(
  opts: LoadCustomEntOptions<User>,
  ctx: Context | undefined,
  expIds?: number[],
) {
  const count = await loadCustomCount(opts, clause.Greater("id", 5), ctx);
  expect(count).toBe(expIds?.length || 5);
  expect(ml.logs.length).toBe(1);

  // re-query. hits the db
  const count2 = await loadCustomCount(opts, clause.Greater("id", 5), ctx);
  expect(count).toEqual(count2);
  expect(ml.logs.length).toBe(2);
  const lastLog = ml.logs[1];

  // if context, cache hit, otherwise, hits db
  if (ctx) {
    expect(lastLog["dataloader-cache-hit"]).toBeDefined();
    expect(lastLog["query"]).toBeUndefined();
  } else {
    expect(lastLog["dataloader-cache-hit"]).toBeUndefined();
    expect(lastLog["query"]).toBeDefined();
  }
}

async function queryCountViaClausePlusDeletedAt(
  opts: LoadCustomEntOptions<User>,
  ctx: Context | undefined,
  expIds?: number[],
) {
  const count = await loadCustomCount(
    opts,
    clause.And(clause.Greater("id", 5), clause.NotEq("deleted_at", null)),
    ctx,
  );
  expect(count).toBe(expIds?.length || 5);
  expect(ml.logs.length).toBe(1);

  // re-query. hits the db
  const count2 = await loadCustomCount(
    opts,
    clause.And(clause.Greater("id", 5), clause.NotEq("deleted_at", null)),
    ctx,
  );
  expect(count).toEqual(count2);
  expect(ml.logs.length).toBe(2);
  const lastLog = ml.logs[1];

  // if context, cache hit, otherwise, hits db
  if (ctx) {
    expect(lastLog["dataloader-cache-hit"]).toBeDefined();
    expect(lastLog["query"]).toBeUndefined();
  } else {
    expect(lastLog["dataloader-cache-hit"]).toBeUndefined();
    expect(lastLog["query"]).toBeDefined();
  }
}

async function queryViaOptions(
  opts: LoadCustomEntOptions<User>,
  ctx: Context | undefined,
  expIds?: number[],
) {
  return queryViaOptionsImpl(
    opts,
    ctx,
    {
      clause: clause.Greater("id", 5),
      orderby: [
        {
          column: "id",
          direction: "DESC",
        },
      ],
    },
    expIds || reversed.slice(0, 5),
  );
}

async function queryViaOptionsWithOffset(
  opts: LoadCustomEntOptions<User>,
  ctx: Context | undefined,
  expIds?: number[],
) {
  return queryViaOptionsImpl(
    opts,
    ctx,
    {
      clause: clause.Greater("id", 5),
      orderby: [
        {
          column: "id",
          direction: "DESC",
        },
      ],
      limit: 2,
      offset: 1,
    },
    expIds || reversed.slice(0, 5).slice(1, 3),
  );
}

async function queryViaOptionsPlusDeletedAt(
  opts: LoadCustomEntOptions<User>,
  ctx: Context | undefined,
  expIds?: number[],
) {
  return queryViaOptionsImpl(
    opts,
    ctx,
    {
      clause: clause.And(
        clause.Greater("id", 5),
        clause.NotEq("deleted_at", null),
      ),
      orderby: [
        {
          column: "id",
          direction: "DESC",
        },
      ],
    },
    expIds || reversed.slice(0, 5),
  );
}

async function queryViaOptionsWithComplexOrderBy(
  opts: LoadCustomEntOptions<User>,
  ctx: Context | undefined,
  orderby: OrderBy,
  expIds?: number[],
) {
  if (Dialect.Postgres !== DB.getDialect()) {
    return;
  }

  return queryViaOptionsImpl(
    opts,
    ctx,
    {
      clause: clause.Greater("id", 5),
      orderby,
    },
    expIds || reversed.slice(0, 5),
  );
}

async function queryViaOptionsDisableTransformations(
  opts: LoadCustomEntOptions<User>,
  ctx: Context | undefined,
) {
  const opts2: QueryDataOptions = {
    clause: clause.Greater("id", 5),
    disableTransformations: true,
    orderby: [
      {
        column: "id",
        direction: "DESC",
      },
    ],
  };
  // get all the ids even the deleted ones back...
  await queryViaOptionsImpl(opts, ctx, opts2, reversed.slice(0, 5));
}

async function queryViaOptionsImpl(
  opts: LoadCustomEntOptions<User>,
  ctx: Context | undefined,
  opts2: QueryDataOptions,
  expIds: number[],
) {
  const data = await loadCustomData(opts, opts2, ctx);

  expect(data.length).toBe(expIds.length);
  expect(data.map((row) => row.id)).toEqual(expIds);
  expect(ml.logs.length).toBe(1);

  // re-query. hits the db
  const data2 = await loadCustomData(opts, opts2, ctx);
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

async function queryCountViaOptions(
  opts: LoadCustomEntOptions<User>,
  ctx: Context | undefined,
  expIds?: number[],
) {
  const count = await loadCustomCount(
    opts,
    {
      clause: clause.Greater("id", 5),
    },
    ctx,
  );

  expect(count).toBe((expIds || reversed.slice(0, 5)).length);
  expect(ml.logs.length).toBe(1);

  // re-query. hits the db
  const count2 = await loadCustomCount(
    opts,
    {
      clause: clause.Greater("id", 5),
    },
    ctx,
  );
  expect(count).toEqual(count2);
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

async function queryCountViaOptionsPlusDeletedAt(
  opts: LoadCustomEntOptions<User>,
  ctx: Context | undefined,
  expIds?: number[],
) {
  const count = await loadCustomCount(
    opts,
    {
      clause: clause.And(
        clause.Greater("id", 5),
        clause.NotEq("deleted_at", null),
      ),
    },
    ctx,
  );

  expect(count).toBe((expIds || reversed.slice(0, 5)).length);
  expect(ml.logs.length).toBe(1);

  // re-query. hits the db
  const count2 = await loadCustomCount(
    opts,
    {
      clause: clause.And(
        clause.Greater("id", 5),
        clause.NotEq("deleted_at", null),
      ),
    },
    ctx,
  );
  expect(count).toEqual(count2);
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

async function queryCountViaOptionsDisableTransformations(
  opts: LoadCustomEntOptions<User>,
  ctx: Context | undefined,
) {
  const count = await loadCustomCount(
    opts,
    {
      clause: clause.Greater("id", 5),
      disableTransformations: true,
    },
    ctx,
  );

  expect(count).toBe(reversed.slice(0, 5).length);
  expect(ml.logs.length).toBe(1);

  // re-query. hits the db
  const count2 = await loadCustomCount(
    opts,
    {
      clause: clause.Greater("id", 5),
      disableTransformations: true,
    },
    ctx,
  );
  expect(count).toEqual(count2);
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

function commonTests(opts: LoadCustomEntOptions<User, Viewer, DataRow>) {
  describe("loadCustomData", () => {
    test("query via SQL with context", async () => {
      await queryViaSQLQuery(opts, getCtx(undefined));
    });

    test("query via SQL without context", async () => {
      await queryViaSQLQuery(opts, undefined);
    });

    test("clause with context", async () => {
      await queryViaClause(opts, getCtx(undefined));
    });

    test("clause without context", async () => {
      await queryViaClause(opts, undefined);
    });

    test("options with context", async () => {
      await queryViaOptions(opts, getCtx(undefined));
    });

    test("options without context", async () => {
      await queryViaOptions(opts, undefined);
    });

    test("options with offset with context", async () => {
      await queryViaOptionsWithOffset(opts, getCtx(undefined));
    });

    test("options with offset without context", async () => {
      await queryViaOptionsWithOffset(opts, undefined);
    });

    test("options with order by nullable column desc, default with context", async () => {
      await queryViaOptionsWithComplexOrderBy(
        opts,
        getCtx(undefined),
        [
          // postgres is nulls first by default
          {
            column: "qux",
            direction: "DESC",
          },
          {
            column: "id",
            direction: "DESC",
          },
        ],
        [10, 8, 6, 9, 7],
      );
    });

    test("options with order by nullable column desc, nulls first with context", async () => {
      // postgres is nulls first by default so matches above
      await queryViaOptionsWithComplexOrderBy(
        opts,
        getCtx(undefined),
        [
          // postgres is nulls first by default for desc so result matches above
          {
            column: "qux",
            direction: "DESC",
            nullsPlacement: "first",
          },
          {
            column: "id",
            direction: "DESC",
          },
        ],
        [10, 8, 6, 9, 7],
      );
    });

    test("options with order by nullable column desc, nulls last with context", async () => {
      await queryViaOptionsWithComplexOrderBy(
        opts,
        getCtx(undefined),
        [
          {
            column: "qux",
            direction: "DESC",
            nullsPlacement: "last",
          },
          {
            column: "id",
            direction: "DESC",
          },
        ],
        [9, 7, 10, 8, 6],
      );
    });

    test("options with order by nullable column asc, default with context", async () => {
      await queryViaOptionsWithComplexOrderBy(
        opts,
        getCtx(undefined),
        [
          // postgres is nulls last when ascending by default
          {
            column: "qux",
            direction: "ASC",
          },
          {
            column: "id",
            direction: "ASC",
          },
        ],
        [7, 9, 6, 8, 10],
      );
    });

    test("options with order by nullable column asc, nulls last with context", async () => {
      // postgres is nulls first by default so matches above
      await queryViaOptionsWithComplexOrderBy(
        opts,
        getCtx(undefined),
        [
          // postgres is nulls last when ascending by default so result matches above
          {
            column: "qux",
            direction: "ASC",
            nullsPlacement: "last",
          },
          {
            column: "id",
            direction: "ASC",
          },
        ],
        [7, 9, 6, 8, 10],
      );
    });

    test("options with order by nullable column asc, nulls first with context", async () => {
      await queryViaOptionsWithComplexOrderBy(
        opts,
        getCtx(undefined),
        [
          {
            column: "qux",
            direction: "ASC",
            nullsPlacement: "first",
          },
          {
            column: "id",
            direction: "ASC",
          },
        ],
        [6, 8, 10, 7, 9],
      );
    });

    test("query via parameterized query with context", async () => {
      await queryViaParameterizedQuery(opts, getCtx(undefined));
    });

    test("query via parameterized query without context", async () => {
      await queryViaParameterizedQuery(opts, undefined);
    });

    test("different types", async () => {
      // this exists just to test typing of different types
      await loadCustomData<QueryDataRow, DataRow>(
        opts,
        clause.Greater("created_at", new Date().toISOString()),
        ctx,
      );
    });
  });

  describe("loadCustomCount", () => {
    test("query count via SQL with context", async () => {
      await queryCountViaSQLQuery(opts, getCtx(undefined));
    });

    test("query count via SQL without context", async () => {
      await queryCountViaSQLQuery(opts, undefined);
    });

    test("query count via clause with context", async () => {
      await queryCountViaClause(opts, getCtx(undefined));
    });

    test("query count via clause without context", async () => {
      await queryCountViaClause(opts, undefined);
    });

    test("count options with context", async () => {
      await queryCountViaOptions(opts, getCtx(undefined));
    });

    test("count options without context", async () => {
      await queryCountViaOptions(opts, undefined);
    });

    test("count options with alias does not prefix count field", async () => {
      await loadCustomCount(
        opts,
        {
          alias: "foo",
          clause: clause.Eq("bar", "bar2"),
        },
        getCtx(undefined),
      );

      expect(ml.logs.length).toBe(1);
      const log = ml.logs[0];
      expect(log.query).toContain("SELECT count(1) as count");
      expect(log.query).toContain("FROM users AS foo");
      expect(log.query).toContain("WHERE foo.bar");
      expect(log.query).not.toContain("foo.count(1)");
    });

    test("query via parameterized query with context", async () => {
      await queryCountViaParameterizedQuery(opts, getCtx(undefined));
    });

    test("query via parameterized query without context", async () => {
      await queryCountViaParameterizedQuery(opts, undefined);
    });
  });

  describe("loadCustomEnts", () => {
    function sortedEntIds(ents: User[], ascending?: boolean) {
      if (ascending) {
        return ents.map((ent) => ent.id as number).sort((a, b) => a - b);
      }
      return ents.map((ent) => ent.id as number).sort((a, b) => b - a);
    }

    test("raw query", async () => {
      const v = getIDViewer(1, getCtx());

      const ents = await loadCustomEnts(
        v,
        opts,
        "select * from users order by id desc",
      );
      expect(ents.length).toBe(5);
      expect(sortedEntIds(ents)).toEqual([9, 7, 5, 3, 1]);
    });

    test("clause", async () => {
      const v = getIDViewer(1, getCtx());

      const ents = await loadCustomEnts(v, opts, clause.Eq("bar", "bar2"));
      // not visible... all even
      expect(ents.length).toBe(0);

      // reload with different viewer and we should get data now
      const v2 = getIDViewer(2, getCtx());

      const ents2 = await loadCustomEnts(v2, opts, clause.Eq("bar", "bar2"));
      expect(ents2.length).toBe(5);
      expect(sortedEntIds(ents2, true)).toEqual(even.slice());
    });

    test("options", async () => {
      const v = getIDViewer(1, getCtx());

      const ents = await loadCustomEnts(v, opts, {
        ...options,
        clause: clause.LessEq("id", 5),
        orderby: [
          {
            column: "id",
            direction: "DESC",
          },
        ],
      });
      expect(ents.length).toBe(3);

      // only even numbers visible
      expect(sortedEntIds(ents)).toEqual([5, 3, 1]);
    });

    test("options with offset", async () => {
      const v = getIDViewer(2, getCtx());

      const ents = await loadCustomEnts(v, opts, {
        ...options,
        clause: clause.Eq("bar", "bar2"),
        orderby: [
          {
            column: "id",
            direction: "DESC",
          },
        ],
        limit: 2,
        offset: 1,
      });
      expect(ents.length).toBe(2);
      expect(sortedEntIds(ents)).toEqual([8, 6]);
    });

    test("with prime", async () => {
      const opts2 = {
        ...opts,
        prime: true,
      };
      const v = getIDViewer(2, getCtx());

      const ents = await loadCustomEnts(
        v,
        opts2,
        "select * from users order by id desc",
      );
      expect(ents.length).toBe(5);
      expect(sortedEntIds(ents)).toEqual([10, 8, 6, 4, 2]);
      // just a select *
      expect(ml.logs.length).toBe(1);
      expect(ml.logs).toStrictEqual([
        { query: "select * from users order by id desc", values: [] },
      ]);

      ml.clear();

      // load ids after. no new queries. all cache hits even the null ones
      const ents2 = await loadEnts(v, opts2, ...ids);
      expect(ents2.size).toBe(5);
      for (const ent of ents) {
        expect(ent).toBe(ents2.get(ent.id));
      }
      expect(ml.logs.length).toBe(ids.length);
      expect(ml.logs).toStrictEqual(
        ids.map((id) => ({
          "ent-cache-hit": `idViewer:2:${opts.loaderFactory.name}:${id}`,
        })),
      );
    });

    test("prime. with partial hit", async () => {
      const opts2 = {
        ...opts,
        prime: true,
      };
      const v = getIDViewer(2, getCtx());

      const ents = await loadCustomEnts(v, opts2, {
        clause: clause.Eq("bar", "bar2"),
        orderby: [
          {
            column: "id",
            direction: "DESC",
          },
        ],
      });
      expect(ents.length).toBe(5);
      expect(sortedEntIds(ents)).toEqual([10, 8, 6, 4, 2]);
      expect(ml.logs.length).toBe(1);
      expect(ml.logs[0].query).toMatch(
        /SELECT \* FROM users WHERE bar = .+ ORDER BY id DESC/,
      );

      ml.clear();

      // load ids after. no new queries. correct values hit the cache
      const ents2 = await loadEnts(v, opts2, ...ids);
      expect(ents2.size).toBe(5);
      for (const ent of ents) {
        expect(ent).toBe(ents2.get(ent.id));
      }

      expect(ml.logs.length).toBe(6);
      expect(ml.logs.slice(0, 5)).toStrictEqual(
        even.map((id) => ({
          "ent-cache-hit": `idViewer:2:${opts.loaderFactory.name}:${id}`,
        })),
      );
      expect(ml.logs[5].query).toMatch(/SELECT \* FROM users WHERE id IN/);
      expect(ml.logs[5].values).toStrictEqual([1, 3, 5, 7, 9]);
    });

    test("no prime. query after", async () => {
      const v = getIDViewer(2, getCtx());

      const ents = await loadCustomEnts(v, opts, {
        clause: clause.Eq("bar", "bar2"),
        orderby: [
          {
            column: "id",
            direction: "DESC",
          },
        ],
      });
      expect(ents.length).toBe(5);
      expect(ents.map((ent) => ent.id)).toEqual([10, 8, 6, 4, 2]);
      expect(ml.logs.length).toBe(1);
      expect(ml.logs[0].query).toMatch(
        /SELECT \* FROM users WHERE bar = .+ ORDER BY id DESC/,
      );

      ml.clear();

      const ents2 = await loadEnts(v, opts, ...ids);
      expect(ents2.size).toBe(5);
      for (const ent of ents) {
        expect(ent).toBe(ents2.get(ent.id));
      }

      // even with no prime. partial hit because of ent cache
      expect(ml.logs.length).toBe(6);
      expect(ml.logs.slice(0, 5)).toStrictEqual(
        even.map((id) => ({
          "ent-cache-hit": `idViewer:2:${opts.loaderFactory.name}:${id}`,
        })),
      );
      expect(ml.logs[5].query).toMatch(/SELECT \* FROM users WHERE id IN/);
      expect(ml.logs[5].values).toStrictEqual([1, 3, 5, 7, 9]);
    });

    test("different types", async () => {
      // this exists just to test typing of different types
      await loadCustomEnts<User, Viewer, QueryDataRow, DataRow>(
        loggedOutViewer,
        opts,
        clause.Greater("created_at", new Date().toISOString()),
      );
    });
  });
}

function softDeleteTests(opts: LoadCustomEntOptions<User>) {
  describe("loadCustomData soft delete", () => {
    beforeEach(async () => {
      await softDelete(softDeleteIds);
      ml.clear();
    });

    test("query via SQL with context", async () => {
      // query via sql doesn't affect soft delete so query is the same.
      await queryViaSQLQuery(opts, getCtx(undefined));
      ml.clear();

      await querySoftDeleteViaSQLQuery(opts, getCtx(undefined));
    });

    test("query via SQL without context", async () => {
      // query via sql doesn't affect soft delete so query is the same.
      await queryViaSQLQuery(opts, undefined);
      ml.clear();

      await querySoftDeleteViaSQLQuery(opts, undefined);
    });

    test("clause with context", async () => {
      // clause automatically adds transformed clause so we end up subtracting deleted_ids 7,8,9,10
      await queryViaClause(opts, getCtx(undefined), [6]);
    });

    test("clause without context", async () => {
      // clause automatically adds transformed clause so we end up subtracting deleted_ids 7,8,9,10
      await queryViaClause(opts, undefined, [6]);
    });

    test("clause with context including deleted_at", async () => {
      // because explicitly indicating deleted_at is not null, we don't automatically add it back in
      await queryViaClausePlusDeletedAt(opts, getCtx(undefined), [7, 8, 9, 10]);
    });

    test("clause without context including deleted_at", async () => {
      // because explicitly indicating deleted_at is not null, we don't automatically add it back in
      await queryViaClausePlusDeletedAt(opts, undefined, [7, 8, 9, 10]);
    });

    test("options with context", async () => {
      await queryViaOptions(opts, getCtx(undefined), [6]);
    });

    test("options without context", async () => {
      await queryViaOptions(opts, undefined, [6]);
    });

    // these 2 are flipped from above because we are querying for deleted items
    // and now we respect that and don't automatically add deleted_at is null back in
    test("options without context including deleted at", async () => {
      await queryViaOptionsPlusDeletedAt(
        opts,
        getCtx(undefined),
        [10, 9, 8, 7],
      );
    });

    test("options without context including deleted at", async () => {
      await queryViaOptionsPlusDeletedAt(opts, undefined, [10, 9, 8, 7]);
    });

    test("options disable transformations with context", async () => {
      await queryViaOptionsDisableTransformations(opts, getCtx(undefined));
    });

    test("options disable transformations without context", async () => {
      await queryViaOptionsDisableTransformations(opts, undefined);
    });

    test("query via parameterized query with context", async () => {
      // query via parameterized query doesn't affect soft delete so query is the same.

      await queryViaParameterizedQuery(opts, getCtx(undefined));

      ml.clear();

      await querySoftDeleteViaParameterizedQuery(opts, getCtx(undefined));
    });

    test("query via parameterized query without context", async () => {
      // query via parameterized doesn't affect soft delete so query is the same.

      await queryViaParameterizedQuery(opts, undefined);

      ml.clear();

      await querySoftDeleteViaParameterizedQuery(opts, undefined);
    });
  });

  describe("loadCustomCount soft delete", () => {
    beforeEach(async () => {
      await softDelete(softDeleteIds);
      ml.clear();
    });

    test("query count via SQL with context", async () => {
      await queryCountViaSQLQuery(opts, getCtx(undefined));
    });

    test("query count via SQL without context", async () => {
      await queryCountViaSQLQuery(opts, undefined);
    });

    test("query count via clause with context", async () => {
      await queryCountViaClause(opts, getCtx(undefined), [6]);
    });

    test("query count via clause without context", async () => {
      await queryCountViaClause(opts, undefined, [6]);
    });

    test("query count via clause plus deleted_at with context", async () => {
      await queryCountViaClausePlusDeletedAt(
        opts,
        getCtx(undefined),
        [7, 8, 9, 10],
      );
    });

    test("query count via clause plus deleted_at without context", async () => {
      await queryCountViaClausePlusDeletedAt(opts, undefined, [7, 8, 9, 10]);
    });

    test("count options with context", async () => {
      await queryCountViaOptions(opts, getCtx(undefined), [6]);
    });

    test("count options without context", async () => {
      await queryCountViaOptions(opts, undefined, [6]);
    });

    test("count options plus deleted_at with context", async () => {
      await queryCountViaOptionsPlusDeletedAt(
        opts,
        getCtx(undefined),
        [7, 8, 9, 10],
      );
    });

    test("count options plus deleted_at without context", async () => {
      await queryCountViaOptionsPlusDeletedAt(opts, undefined, [7, 8, 9, 10]);
    });

    test("count options disable transformations with context", async () => {
      await queryCountViaOptionsDisableTransformations(opts, getCtx(undefined));
    });

    test("count options disable transformations without context", async () => {
      await queryCountViaOptionsDisableTransformations(opts, undefined);
    });

    test("query count via parameterized query with context", async () => {
      await queryCountViaParameterizedQuery(opts, getCtx(undefined));
    });

    test("query count via parameterized query without context", async () => {
      await queryCountViaParameterizedQuery(opts, undefined);
    });

    test("query count via parameterized query with context", async () => {
      // query via parameterized query doesn't affect soft delete so query is the same.

      await queryCountViaParameterizedQuery(opts, getCtx(undefined));

      ml.clear();

      await querySoftDeleteCountViaParameterizedQuery(opts, getCtx(undefined));
    });

    test("query via parameterized query without context", async () => {
      // query via parameterized doesn't affect soft delete so query is the same.

      await queryCountViaParameterizedQuery(opts, undefined);

      ml.clear();

      await querySoftDeleteCountViaParameterizedQuery(opts, undefined);
    });
  });

  describe("loadCustomEnts soft delete", () => {
    beforeEach(async () => {
      await softDelete(softDeleteIds);
      ml.clear();
    });

    test("raw query", async () => {
      const v = getIDViewer(1, getCtx());

      // soft deleted items are included...
      const ents = await loadCustomEnts(
        v,
        opts,
        "select * from users order by id desc",
      );
      expect(ents.length).toBe(5);
      expect(ents.map((ent) => ent.id)).toEqual([9, 7, 5, 3, 1]);

      const ents2 = await loadCustomEnts(
        v,
        opts,
        "select * from users WHERE deleted_at IS NULL order by id desc",
      );
      expect(ents2.length).toBe(3);
      expect(ents2.map((ent) => ent.id)).toEqual([5, 3, 1]);
    });

    test("clause", async () => {
      const v = getIDViewer(1, getCtx());

      const ents = await loadCustomEnts(v, opts, clause.Eq("bar", "bar2"));
      // not visible... all even
      expect(ents.length).toBe(0);

      // reload with different viewer and we should get data now
      const v2 = getIDViewer(2, getCtx());

      const ents2 = await loadCustomEnts(v2, opts, clause.Eq("bar", "bar2"));
      // soft deleted items not included...
      expect(ents2.length).toBe(3);
      expect(ents2.map((ent) => ent.id).sort()).toEqual([2, 4, 6]);
    });

    test("clause soft deleted included", async () => {
      const v = getIDViewer(1, getCtx());

      const ents = await loadCustomEnts(
        v,
        opts,
        clause.And(clause.Eq("bar", "bar2"), clause.NotEq("deleted_at", null)),
      );
      // not visible... all even
      expect(ents.length).toBe(0);

      // reload with different viewer and we should get data now
      const v2 = getIDViewer(2, getCtx());

      const ents2 = await loadCustomEnts(
        v2,
        opts,
        clause.And(clause.Eq("bar", "bar2"), clause.NotEq("deleted_at", null)),
      );
      // only soft deleted items included since we explicitly queried for them
      expect(ents2.length).toBe(2);
      expect(ents2.map((ent) => ent.id).sort()).toEqual([10, 8]);
    });

    test("options", async () => {
      const v = getIDViewer(1, getCtx());

      const ents = await loadCustomEnts(v, opts, {
        ...opts,
        // deleted_at automatically added...
        clause: clause.GreaterEq("id", 5),
        orderby: [
          {
            column: "id",
            direction: "DESC",
          },
        ],
      });
      expect(ents.length).toBe(1);

      // only odd numbers visible
      expect(ents.map((ent) => ent.id)).toEqual([5]);

      const ents2 = await loadCustomEnts(v, opts, {
        ...opts,
        // deleted_at automatically added...
        clause: clause.GreaterEq("id", 5),
        orderby: [
          {
            column: "id",
            direction: "DESC",
          },
        ],
        disableTransformations: true,
      });
      expect(ents2.length).toBe(3);

      // only odd numbers visible
      expect(ents2.map((ent) => ent.id)).toEqual([9, 7, 5]);
    });

    test("options soft delete included", async () => {
      const v = getIDViewer(1, getCtx());

      const ents = await loadCustomEnts(v, opts, {
        ...opts,
        clause: clause.And(
          clause.GreaterEq("id", 5),
          clause.NotEq("deleted_at", null),
        ),
        orderby: [
          {
            column: "id",
            direction: "DESC",
          },
        ],
      });
      expect(ents.length).toBe(2);

      // only odd numbers visible
      expect(ents.map((ent) => ent.id)).toEqual([9, 7]);

      const ents2 = await loadCustomEnts(v, opts, {
        ...opts,
        clause: clause.And(
          clause.GreaterEq("id", 5),
          clause.NotEq("deleted_at", null),
        ),
        orderby: [
          {
            column: "id",
            direction: "DESC",
          },
        ],
        disableTransformations: true,
      });
      expect(ents2.length).toBe(2);

      // only odd numbers visible
      expect(ents2.map((ent) => ent.id)).toEqual([9, 7]);
    });
  });

  describe("custom query soft delete", () => {
    beforeEach(async () => {
      await softDelete(softDeleteIds);
      ml.clear();
    });

    class CustomQuery extends CustomEdgeQueryBase<any, any> {
      constructor(
        v: IDViewer,
        cls: clause.Clause,
        disableTransformations?: boolean,
      ) {
        super(v, {
          src: v.viewerID,
          loadEntOptions: softDeleteOptions,
          clause: cls,
          name: "bar=bar2",
          disableTransformations,
        });
      }
      sourceEnt(id: ID) {
        return loadEnt(this.viewer, id, softDeleteOptions);
      }
    }

    test("simple clause", async () => {
      const v = getIDViewer(2, getCtx());

      const q = new CustomQuery(v, clause.Eq("bar", "bar2"));
      const ids = await q.queryIDs();
      expect(ids.sort()).toEqual([2, 4, 6]);

      const ents = await q.queryEnts();
      expect(ents.length).toBe(3);

      const count = await q.queryCount();
      expect(count).toBe(3);

      ml.clear();

      await Promise.all(
        ents.map((ent) => loadEnt(v, ent.id, softDeleteOptions)),
      );

      expect(ml.logs.length).toBe(count);
      for (const log of ml.logs) {
        expect(log["ent-cache-hit"]).toBeDefined();
      }
    });

    test("simple clause with query for deleted at", async () => {
      const v = getIDViewer(2, getCtx());

      const q = new CustomQuery(
        v,
        clause.And(clause.Eq("bar", "bar2"), clause.NotEq("deleted_at", null)),
      );

      const ids = await q.queryIDs();
      expect(ids.sort()).toEqual([10, 8]);

      const ents = await q.queryEnts();
      expect(ents.length).toBe(2);

      const count = await q.queryCount();
      expect(count).toBe(2);

      ml.clear();

      await Promise.all(
        ents.map((ent) => loadEnt(v, ent.id, softDeleteOptions)),
      );

      expect(ml.logs.length).toBe(count);
      for (const log of ml.logs) {
        expect(log["ent-cache-hit"]).toBeDefined();
      }
    });

    test("disable Transformations", async () => {
      const v = getIDViewer(2, getCtx());

      const q = new CustomQuery(v, clause.Eq("bar", "bar2"), true);
      const ids = await q.queryIDs();
      expect(ids.sort()).toEqual([10, 2, 4, 6, 8]);

      const ents = await q.queryEnts();
      expect(ents.length).toBe(5);

      const count = await q.queryCount();
      expect(count).toBe(5);

      ml.clear();

      await Promise.all(
        ents.map((ent) => loadEnt(v, ent.id, softDeleteOptions)),
      );

      expect(ml.logs.length).toBe(count);
      for (const log of ml.logs) {
        expect(log["ent-cache-hit"]).toBeDefined();
      }
    });

    test("disable Transformations while quering deleted at", async () => {
      const v = getIDViewer(2, getCtx());

      const q = new CustomQuery(
        v,
        clause.And(clause.Eq("bar", "bar2"), clause.NotEq("deleted_at", null)),
        true,
      );
      const ids = await q.queryIDs();
      expect(ids.sort()).toEqual([10, 8]);

      const ents = await q.queryEnts();
      expect(ents.length).toBe(2);

      const count = await q.queryCount();
      expect(count).toBe(2);

      ml.clear();

      await Promise.all(
        ents.map((ent) => loadEnt(v, ent.id, softDeleteOptions)),
      );

      expect(ml.logs.length).toBe(count);
      for (const log of ml.logs) {
        expect(log["ent-cache-hit"]).toBeDefined();
      }
    });
  });
}

function mixTests() {
  test("no clause then soft delete load", async () => {
    const v = getIDViewer(1, getCtx());

    const ents = await loadCustomEnts(
      v,
      options,
      "select * from users order by id desc",
    );
    expect(ents.length).toBe(5);
    expect(ents.map((ent) => ent.id)).toEqual([9, 7, 5, 3, 1]);

    await softDelete(softDeleteIds);
    ml.clear();
    const ents2 = await loadEnts(v, softDeleteOptions, ...ids);
    // 5,3,1
    expect(ents2.size).toBe(3);

    // still hit the db and no ent cache even though all just loaded
    expect(ml.logs.length).toBe(1);
    expect(ml.logs[0].query).toMatch(
      /SELECT \* FROM users WHERE id IN .+ AND deleted_at IS NULL/,
    );
    expect(ml.logs[0].values).toStrictEqual(ids);
  });

  test("no clause then soft delete load. no soft delete in between", async () => {
    const v = getIDViewer(1, getCtx());

    const ents = await loadCustomEnts(
      v,
      options,
      "select * from users order by id desc",
    );
    expect(ents.length).toBe(5);
    expect(ents.map((ent) => ent.id)).toEqual([9, 7, 5, 3, 1]);

    ml.clear();
    const ents2 = await loadEnts(v, softDeleteOptions, ...ids);
    // 9,7,5,3,1
    expect(ents2.size).toBe(5);

    // still hit the db and no ent cache even though all just loaded
    expect(ml.logs.length).toBe(1);
    expect(ml.logs[0].query).toMatch(
      /SELECT \* FROM users WHERE id IN .+ AND deleted_at IS NULL/,
    );
    expect(ml.logs[0].values).toStrictEqual(ids);
  });

  test("soft delete then no soft delete", async () => {
    const v = getIDViewer(1, getCtx());

    const ents = await loadCustomEnts(
      v,
      softDeleteOptions,
      "select * from users where deleted_at IS NULL order by id desc",
    );
    expect(ents.length).toBe(5);
    expect(ents.map((ent) => ent.id)).toEqual([9, 7, 5, 3, 1]);

    ml.clear();
    const ents2 = await loadEnts(v, options, ...ids);
    // 9,7,5,3,1
    expect(ents2.size).toBe(5);

    // still hit the db and no ent cache even though all just loaded
    expect(ml.logs.length).toBe(1);
    expect(ml.logs[0].query).toMatch(/SELECT \* FROM users WHERE id IN/);
    expect(ml.logs[0].values).toStrictEqual(ids);
  });
}

// TODO prime logic with disableTransformations and different combos...
