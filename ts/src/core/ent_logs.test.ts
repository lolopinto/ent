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
} from "./ent";
import { clearLogLevels, setLogLevels } from "./logger";
import * as clause from "./clause";

jest.mock("pg");
QueryRecorder.mockPool(Pool);

afterEach(() => {
  QueryRecorder.clear();
});

describe.only("logging", () => {
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

  beforeEach(() => {
    setLogLevels(["query", "error"]);
  });

  afterEach(() => {
    clearLogLevels();
    logs = [];
    errors = [];
  });

  afterAll(() => {
    console.log = oldConsoleLog;
    console.error = oldConsoleError;
  });

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
