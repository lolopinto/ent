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
  Viewer,
  loadEnt,
  loadEnts,
} from "./ent";
import { clearLogLevels, setLogLevels } from "./logger";
import * as clause from "./clause";
import { Context, ContextCache } from "./context";
import { LoggedOutViewer } from "./viewer";
import { User } from "../testutils/builder";
jest.mock("pg");
QueryRecorder.mockPool(Pool);

afterEach(() => {
  QueryRecorder.clear();
});

let oldConsoleError;
let oldConsoleLog;
let logs: any[] = [];
let errors: any[] = [];

beforeAll(() => {
  oldConsoleLog = console.log;
  oldConsoleError = console.error;

  console.log = (...any) => {
    logs.push(...any);
  };
  console.error = (...any) => {
    errors.push(...any);
  };
});

afterAll(() => {
  console.log = oldConsoleLog;
  console.error = oldConsoleError;
});

beforeEach(() => {
  setLogLevels(["query", "error"]);
});

afterEach(() => {
  clearLogLevels();
  logs = [];
  errors = [];
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
    expect(logs.length).toEqual(1);
    expect(logs[0]).toStrictEqual({
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
    expect(logs.length).toEqual(1);
    expect(logs[0]).toStrictEqual({
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
    expect(logs.length).toEqual(1);
    expect(logs[0]).toStrictEqual({
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
    expect(logs.length).toEqual(0);
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

    expect(logs.length).toEqual(1);
    expect(logs[0]).toStrictEqual({
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

    expect(logs.length).toEqual(1);
    expect(logs[0]).toStrictEqual({
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

    expect(logs.length).toEqual(1);
    expect(logs[0]).toStrictEqual({
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

    expect(logs.length).toEqual(0);
  });

  test("deleteRow", async () => {
    await deleteRowsForTest(
      {
        tableName: "t1",
      },
      clause.Eq("col", 1),
    );

    expect(logs.length).toEqual(1);
    expect(logs[0]).toStrictEqual({
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

    expect(logs.length).toEqual(1);
    expect(logs[0]).toStrictEqual({
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

    expect(logs.length).toEqual(0);
  });

  test("loadRow", async () => {
    await loadRow({
      tableName: "t1",
      fields: ["col1", "col2"],
      clause: clause.Eq("id", 1),
    });

    expect(logs.length).toEqual(1);
    expect(logs[0]).toStrictEqual({
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

    expect(logs.length).toEqual(1);
    expect(logs[0]).toStrictEqual({
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

    expect(logs.length).toEqual(0);
  });

  test("loadRows", async () => {
    await loadRows({
      tableName: "t1",
      fields: ["col1", "col2"],
      clause: clause.Eq("id", 1),
    });

    expect(logs.length).toEqual(1);
    expect(logs[0]).toStrictEqual({
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

    expect(logs.length).toEqual(1);
    expect(logs[0]).toStrictEqual({
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

    expect(logs.length).toEqual(0);
  });
});

class contextImpl implements Context {
  cache: ContextCache = new ContextCache();
  viewer = new LoggedOutViewer(this);

  getViewer(): Viewer {
    return this.viewer;
  }
}

describe("ent cache logging", () => {
  const ctx = new contextImpl();

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
    logs = [];
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

    expect(logs.length).toEqual(0);
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
    expect(logs.length).toEqual(1);

    expect(logs[0]).toStrictEqual({
      query: buildQuery({
        tableName: "t1",
        fields: ["col1", "col2"],
        clause: clause.Eq("id", 1),
      }),
      values: [1],
    });

    // fetch again
    await loadRow(options);

    expect(logs.length).toEqual(2);
    expect(logs[1]).toStrictEqual({
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
    expect(logs.length).toEqual(1);

    expect(logs[0]).toStrictEqual({
      query: buildQuery({
        tableName: "t1",
        fields: ["col1", "col2"],
        clause: clause.In("id", 1),
      }),
      values: [1],
    });

    // fetch again
    await loadRows(options);

    expect(logs.length).toEqual(2);
    expect(logs[1]).toStrictEqual({
      "cache-hit": "col1,col2,in:id:1",
      "tableName": options.tableName,
    });
  });
});

describe("dataloader cache logging", () => {
  const ctx = new contextImpl();

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
    logs = [];
  });

  afterEach(() => {
    ctx.cache.clearCache();
  });

  test("log disabled", async () => {
    clearLogLevels();
    await loadEnt(ctx.getViewer(), 1, {
      fields: ["id", "col1", "col2"],
      tableName: "users",
      ent: User,
    });

    expect(logs.length).toEqual(0);
  });

  test("loadEnt", async () => {
    const options = {
      fields: ["id", "col1", "col2"],
      tableName: "users",
      ent: User,
      context: ctx,
    };
    await loadEnt(ctx.getViewer(), 1, options);

    // regular row fetch. hit db
    expect(logs.length).toEqual(1);

    expect(logs[0]).toStrictEqual({
      query: buildQuery({
        tableName: "users",
        fields: ["id", "col1", "col2"],
        // data loader always does an in fetch...
        clause: clause.In("id", 1),
      }),
      values: [1],
    });

    // fetch again
    await loadEnt(ctx.getViewer(), 1, options);

    expect(logs.length).toEqual(2);
    expect(logs[1]).toStrictEqual({
      "dataloader-cache-hit": 1,
      "tableName": options.tableName,
    });
  });

  test("loadEnts", async () => {
    const options = {
      fields: ["id", "col1", "col2"],
      tableName: "users",
      ent: User,
    };
    await loadEnts(ctx.getViewer(), options, 1);

    // regular row fetch. hit db
    expect(logs.length).toEqual(1);

    expect(logs[0]).toStrictEqual({
      query: buildQuery({
        tableName: "users",
        fields: ["id", "col1", "col2"],
        // data loader always does an in fetch...
        clause: clause.In("id", 1),
      }),
      values: [1],
    });

    // fetch again
    await loadEnts(ctx.getViewer(), options, 1);

    expect(logs.length).toEqual(2);
    expect(logs[1]).toStrictEqual({
      "dataloader-cache-hit": 1,
      "tableName": options.tableName,
    });
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
    logs = [];
  });

  test("log disabled", async () => {
    clearLogLevels();
    await loadEnt(v, 1, {
      fields: ["id", "col1", "col2"],
      tableName: "users",
      ent: User,
    });

    expect(logs.length).toEqual(0);
  });

  test("loadEnt", async () => {
    const options = {
      fields: ["id", "col1", "col2"],
      tableName: "users",
      ent: User,
    };
    await loadEnt(v, 1, options);

    // regular row fetch. hit db
    expect(logs.length).toEqual(1);

    expect(logs[0]).toStrictEqual({
      query: buildQuery({
        tableName: "users",
        fields: ["id", "col1", "col2"],
        clause: clause.Eq("id", 1),
      }),
      values: [1],
    });

    // fetch again
    await loadEnt(v, 1, options);

    expect(logs.length).toEqual(2);
    // no context. hit db
    expect(logs[0]).toStrictEqual(logs[1]);
  });

  test("loadEnts", async () => {
    const options = {
      fields: ["id", "col1", "col2"],
      tableName: "users",
      ent: User,
    };
    await loadEnts(v, options, 1);

    // regular row fetch. hit db
    expect(logs.length).toEqual(1);

    expect(logs[0]).toStrictEqual({
      query: buildQuery({
        tableName: "users",
        fields: ["id", "col1", "col2"],
        clause: clause.In("id", 1),
      }),
      values: [1],
    });

    // fetch again
    await loadEnts(v, options, 1);

    expect(logs.length).toEqual(2);
    // no context. hit db
    expect(logs[0]).toStrictEqual(logs[1]);
  });
});
