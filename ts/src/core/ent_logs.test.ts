import { Pool } from "pg";
import { QueryRecorder } from "../testutils/db_mock";
import {
  createRowForTest,
  editRowForTest,
  deleteRowsForTest,
} from "../testutils/write";
import {
  loadRow,
  loadRows,
  buildInsertQuery,
  buildUpdateQuery,
  buildQuery,
  loadEnt,
  loadEnts,
} from "./ent";
import { clearLogLevels, setLogLevels } from "./logger";
import * as clause from "./clause";
import { LoggedOutViewer } from "./viewer";
import { User } from "../testutils/builder";
import { TestContext } from "../testutils/context/test_context";
import { MockLogs } from "../testutils/mock_log";
import { ObjectLoaderFactory } from "./loaders";

jest.mock("pg");
QueryRecorder.mockPool(Pool);

afterEach(() => {
  QueryRecorder.clear();
});

const ml = new MockLogs();
beforeAll(() => {
  ml.mock();
});

afterAll(() => {
  ml.restore();
});

beforeEach(() => {
  setLogLevels(["query", "error"]);
});

afterEach(() => {
  clearLogLevels();
  ml.clear();
});

describe("raw data access", () => {
  test("createRow no fieldsToLog", async () => {
    const fields = {
      f1: "bar",
      f2: "baz",
    };
    await createRowForTest({
      tableName: "t1",
      fields,
    });
    const [expQuery] = buildInsertQuery({
      fields,
      tableName: "t1",
    });
    expect(ml.logs.length).toEqual(1);
    expect(ml.logs[0]).toStrictEqual({
      query: expQuery,
      // no values since fieldsToLog not passed
      values: [],
    });
  });

  test("createRow with fieldsToLog", async () => {
    const fields = {
      f1: "bar",
      f2: "baz",
    };
    await createRowForTest({
      tableName: "t1",
      fields,
      fieldsToLog: fields,
    });
    const [expQuery] = buildInsertQuery({
      fields,
      tableName: "t1",
    });
    expect(ml.logs.length).toEqual(1);
    expect(ml.logs[0]).toStrictEqual({
      query: expQuery,
      values: ["bar", "baz"],
    });
  });

  test("createRow simulate sensitive", async () => {
    const fields = {
      f1: "bar",
      f2: "baz",
    };
    await createRowForTest({
      tableName: "t1",
      fields,
      fieldsToLog: {
        f1: "bar",
        f2: "***",
      },
    });
    const [expQuery] = buildInsertQuery({
      fields,
      tableName: "t1",
    });
    expect(ml.logs.length).toEqual(1);
    expect(ml.logs[0]).toStrictEqual({
      query: expQuery,
      values: ["bar", "***"],
    });
  });

  test("createRow. logging disabled", async () => {
    const fields = {
      f1: "bar",
      f2: "baz",
    };
    clearLogLevels();
    await createRowForTest({
      tableName: "t1",
      fields,
      fieldsToLog: {
        f1: "bar",
        f2: "***",
      },
    });
    expect(ml.logs.length).toEqual(0);
  });

  test("editRow no fieldsToLog", async () => {
    const fields = {
      f1: "bar",
      f2: "baz",
    };
    const options = {
      fields: fields,
      pkey: "bar",
      tableName: "t1",
    };
    await editRowForTest(options, "1");
    const [expQuery] = buildUpdateQuery(options, "1");

    expect(ml.logs.length).toEqual(1);
    expect(ml.logs[0]).toStrictEqual({
      query: expQuery,
      values: [],
    });
  });

  test("editRow with fieldsToLog", async () => {
    const fields = {
      f1: "bar",
      f2: "baz",
    };
    const options = {
      fields: fields,
      pkey: "bar",
      tableName: "t1",
      fieldsToLog: fields,
    };
    await editRowForTest(options, "1");
    const [expQuery] = buildUpdateQuery(options, "1");

    expect(ml.logs.length).toEqual(1);
    expect(ml.logs[0]).toStrictEqual({
      query: expQuery,
      values: ["bar", "baz"],
    });
  });

  test("editRow simulate sensitive", async () => {
    const fields = {
      f1: "bar",
      f2: "baz",
    };
    const options = {
      fields: fields,
      pkey: "bar",
      tableName: "t1",
      fieldsToLog: {
        f1: "bar",
        f2: "***",
      },
    };
    await editRowForTest(options, "1");
    const [expQuery] = buildUpdateQuery(options, "1");

    expect(ml.logs.length).toEqual(1);
    expect(ml.logs[0]).toStrictEqual({
      query: expQuery,
      values: ["bar", "***"],
    });
  });

  test("editRow. logging disabled ", async () => {
    const fields = {
      f1: "bar",
      f2: "baz",
    };
    const options = {
      fields: fields,
      pkey: "bar",
      tableName: "t1",
      fieldsToLog: fields,
    };
    clearLogLevels();
    await editRowForTest(options, "1");
    const [expQuery] = buildUpdateQuery(options, "1");

    expect(ml.logs.length).toEqual(0);
  });

  test("deleteRow", async () => {
    await deleteRowsForTest(
      {
        tableName: "t1",
      },
      clause.Eq("col", 1),
    );

    expect(ml.logs.length).toEqual(1);
    expect(ml.logs[0]).toStrictEqual({
      query: "DELETE FROM t1 WHERE col = $1",
      values: [1],
    });
  });

  test("deleteRow. sensitive", async () => {
    await deleteRowsForTest(
      {
        tableName: "t1",
      },
      clause.Eq("col", clause.sensitiveValue(1)),
    );

    expect(ml.logs.length).toEqual(1);
    expect(ml.logs[0]).toStrictEqual({
      query: "DELETE FROM t1 WHERE col = $1",
      values: ["*"],
    });
  });

  test("deleteRow. logging disabled", async () => {
    clearLogLevels();
    await deleteRowsForTest(
      {
        tableName: "t1",
      },
      clause.Eq("col", 1),
    );

    expect(ml.logs.length).toEqual(0);
  });

  test("loadRow", async () => {
    await loadRow({
      tableName: "t1",
      fields: ["col1", "col2"],
      clause: clause.Eq("id", 1),
    });

    expect(ml.logs.length).toEqual(1);
    expect(ml.logs[0]).toStrictEqual({
      query: buildQuery({
        tableName: "t1",
        fields: ["col1", "col2"],
        clause: clause.Eq("id", 1),
      }),
      values: [1],
    });
  });

  test("loadRow. sensitive value", async () => {
    await loadRow({
      tableName: "t1",
      fields: ["col1", "col2"],
      clause: clause.Eq("id", clause.sensitiveValue(1)),
    });

    expect(ml.logs.length).toEqual(1);
    expect(ml.logs[0]).toStrictEqual({
      query: buildQuery({
        tableName: "t1",
        fields: ["col1", "col2"],
        clause: clause.Eq("id", 1),
      }),
      values: ["*"],
    });
  });

  test("loadRow. logging disabled", async () => {
    clearLogLevels();
    await loadRow({
      tableName: "t1",
      fields: ["col1", "col2"],
      clause: clause.Eq("id", clause.sensitiveValue(1)),
    });

    expect(ml.logs.length).toEqual(0);
  });

  test("loadRows", async () => {
    await loadRows({
      tableName: "t1",
      fields: ["col1", "col2"],
      clause: clause.Eq("id", 1),
    });

    expect(ml.logs.length).toEqual(1);
    expect(ml.logs[0]).toStrictEqual({
      query: buildQuery({
        tableName: "t1",
        fields: ["col1", "col2"],
        clause: clause.Eq("id", 1),
      }),
      values: [1],
    });
  });

  test("loadRows. sensitive value", async () => {
    await loadRows({
      tableName: "t1",
      fields: ["col1", "col2"],
      clause: clause.Eq("id", clause.sensitiveValue(1)),
    });

    expect(ml.logs.length).toEqual(1);
    expect(ml.logs[0]).toStrictEqual({
      query: buildQuery({
        tableName: "t1",
        fields: ["col1", "col2"],
        clause: clause.Eq("id", 1),
      }),
      values: ["*"],
    });
  });

  test("loadRows. logging disabled", async () => {
    clearLogLevels();
    await loadRows({
      tableName: "t1",
      fields: ["col1", "col2"],
      clause: clause.Eq("id", clause.sensitiveValue(1)),
    });

    expect(ml.logs.length).toEqual(0);
  });
});

describe("ent cache logging", () => {
  const ctx = new TestContext();

  beforeEach(async () => {
    // prime the row
    await createRowForTest({
      tableName: "t1",
      fields: {
        id: 1,
        col1: "col",
        col2: "col",
      },
    });
    ml.clear();
  });

  afterEach(() => {
    ctx.cache.clearCache();
  });

  test("log disabled", async () => {
    clearLogLevels();
    await loadRow({
      tableName: "t1",
      fields: ["col1", "col2"],
      clause: clause.Eq("id", 1),
      context: ctx,
    });

    expect(ml.logs.length).toEqual(0);
  });

  test("loadRow", async () => {
    const options = {
      tableName: "t1",
      fields: ["col1", "col2"],
      clause: clause.Eq("id", 1),
      context: ctx,
    };
    await loadRow(options);

    // regular row fetch. hit db
    expect(ml.logs.length).toEqual(1);

    expect(ml.logs[0]).toStrictEqual({
      query: buildQuery({
        tableName: "t1",
        fields: ["col1", "col2"],
        clause: clause.Eq("id", 1),
      }),
      values: [1],
    });

    // fetch again
    await loadRow(options);

    expect(ml.logs.length).toEqual(2);
    expect(ml.logs[1]).toStrictEqual({
      "cache-hit": "col1,col2,id=1",
      "tableName": options.tableName,
    });
  });

  test("loadRows", async () => {
    const options = {
      tableName: "t1",
      fields: ["col1", "col2"],
      clause: clause.In("id", 1),
      context: ctx,
    };
    await loadRows(options);

    // regular row fetch. hit db
    expect(ml.logs.length).toEqual(1);

    expect(ml.logs[0]).toStrictEqual({
      query: buildQuery({
        tableName: "t1",
        fields: ["col1", "col2"],
        clause: clause.In("id", 1),
      }),
      values: [1],
    });

    // fetch again
    await loadRows(options);

    expect(ml.logs.length).toEqual(2);
    expect(ml.logs[1]).toStrictEqual({
      "cache-hit": "col1,col2,in:id:1",
      "tableName": options.tableName,
    });
  });
});

describe("dataloader cache logging", () => {
  const ctx = new TestContext();

  beforeEach(async () => {
    // prime the row
    await createRowForTest({
      tableName: "users",
      fields: {
        id: 1,
        col1: "col",
        col2: "col",
      },
    });
    ml.clear();
  });

  afterEach(() => {
    ctx.cache.clearCache();
  });

  const fields = ["id", "col1", "col2"];
  const tableName = "users";

  test("loadEnt", async () => {
    const options = {
      fields,
      tableName,
      loaderFactory: new ObjectLoaderFactory({ fields, tableName }),
      ent: User,
      context: ctx,
    };
    const row = await loadEnt(ctx.getViewer(), 1, options);

    // regular row fetch. hit db
    expect(ml.logs.length).toEqual(1);

    expect(ml.logs[0]).toStrictEqual({
      query: buildQuery({
        tableName,
        fields,
        // data loader always does an in fetch...
        clause: clause.In("id", 1),
      }),
      values: [1],
    });

    ml.clear();
    // fetch again
    await loadEnt(ctx.getViewer(), 1, options);

    expect(ml.logs.length).toEqual(1);
    expect(ml.logs[0]).toStrictEqual({
      "dataloader-cache-hit": 1,
      "tableName": options.tableName,
    });
  });

  test("loadEnts", async () => {
    const options = {
      fields,
      tableName,
      loaderFactory: new ObjectLoaderFactory({ fields, tableName }),
      ent: User,
    };
    await loadEnts(ctx.getViewer(), options, 1);

    // regular row fetch. hit db
    expect(ml.logs.length).toEqual(1);

    expect(ml.logs[0]).toStrictEqual({
      query: buildQuery({
        tableName,
        fields,
        // data loader always does an in fetch...
        clause: clause.In("id", 1),
      }),
      values: [1],
    });

    ml.clear();

    // fetch again
    await loadEnts(ctx.getViewer(), options, 1);

    expect(ml.logs.length).toEqual(1);
    expect(ml.logs[0]).toStrictEqual({
      // TODO this will also change when loadEnts changes
      "cache-hit": "id,col1,col2,in:id:1",
      "tableName": options.tableName,
    });
  });
});

describe("dataloader cache logging disabled", () => {
  const ctx = new TestContext();

  beforeEach(async () => {
    // prime the row
    await createRowForTest({
      tableName: "users",
      fields: {
        id: 1,
        col1: "col",
        col2: "col",
      },
    });
    ml.clear();
  });

  afterEach(() => {
    ctx.cache.clearCache();
  });

  const fields = ["id", "col1", "col2"];
  const tableName = "users";

  // this was interfering with above batch so we're breaking it out
  test("log disabled", async () => {
    clearLogLevels();
    await loadEnt(ctx.getViewer(), 1, {
      fields,
      tableName,
      loaderFactory: new ObjectLoaderFactory({ fields, tableName }),
      ent: User,
    });

    expect(ml.logs.length).toEqual(0);
  });
});

describe("loadEnt no context", () => {
  const v = new LoggedOutViewer();
  beforeEach(async () => {
    // prime the row
    await createRowForTest({
      tableName: "users",
      fields: {
        id: 1,
        col1: "col",
        col2: "col",
      },
    });
    ml.clear();
  });

  const fields = ["id", "col1", "col2"];
  const tableName = "users";

  test("log disabled", async () => {
    clearLogLevels();
    await loadEnt(v, 1, {
      fields,
      tableName,
      loaderFactory: new ObjectLoaderFactory({ fields, tableName }),
      ent: User,
    });

    expect(ml.logs.length).toEqual(0);
  });

  test("loadEnt", async () => {
    const options = {
      fields,
      tableName,
      ent: User,
      loaderFactory: new ObjectLoaderFactory({ fields, tableName }),
    };
    await loadEnt(v, 1, options);

    // regular row fetch. hit db
    expect(ml.logs.length).toEqual(1);

    expect(ml.logs[0]).toStrictEqual({
      query: buildQuery({
        tableName,
        fields,
        clause: clause.Eq("id", 1),
      }),
      values: [1],
    });

    // fetch again
    await loadEnt(v, 1, options);

    expect(ml.logs.length).toEqual(2);
    // no context. hit db
    expect(ml.logs[0]).toStrictEqual(ml.logs[1]);
  });

  test("loadEnts", async () => {
    const options = {
      fields,
      tableName,
      loaderFactory: new ObjectLoaderFactory({ fields, tableName }),
      ent: User,
    };
    await loadEnts(v, options, 1);

    // regular row fetch. hit db
    expect(ml.logs.length).toEqual(1);

    expect(ml.logs[0]).toStrictEqual({
      query: buildQuery({
        tableName,
        fields,
        clause: clause.In("id", 1),
      }),
      values: [1],
    });

    // fetch again
    await loadEnts(v, options, 1);

    expect(ml.logs.length).toEqual(2);
    // no context. hit db
    expect(ml.logs[0]).toStrictEqual(ml.logs[1]);
  });
});
