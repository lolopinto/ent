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
import {
  EditRowOptions,
  LoadEntOptions,
  LoadRowOptions,
  LoadRowsOptions,
} from "./base";
import { integer, table, text, setupSqlite } from "../testutils/db/test_db";

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
  ml.clear();
});

afterEach(() => {
  clearLogLevels();
});

function commonTests() {
  describe("raw data access", () => {
    test("createRow no fieldsToLog", async () => {
      const fields = {
        col1: "bar",
        col2: "baz",
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
        col1: "bar",
        col2: "baz",
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
        col1: "bar",
        col2: "baz",
      };
      await createRowForTest({
        tableName: "t1",
        fields,
        fieldsToLog: {
          col1: "bar",
          col2: "***",
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
        col1: "bar",
        col2: "baz",
      };
      clearLogLevels();
      await createRowForTest({
        tableName: "t1",
        fields,
        fieldsToLog: {
          col1: "bar",
          col2: "***",
        },
      });
      expect(ml.logs.length).toEqual(0);
    });

    test("editRow no fieldsToLog", async () => {
      const fields = {
        col1: "bar",
        col2: "baz",
      };
      const options: EditRowOptions = {
        fields: fields,
        key: "id",
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
        col1: "bar",
        col2: "baz",
      };
      const options: EditRowOptions = {
        fields: fields,
        key: "id",
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
        col1: "bar",
        col2: "baz",
      };
      const options: EditRowOptions = {
        fields: fields,
        key: "id",
        tableName: "t1",
        fieldsToLog: {
          col1: "bar",
          col2: "***",
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
        col1: "bar",
        col2: "baz",
      };
      const options: EditRowOptions = {
        fields: fields,
        key: "id",
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
        clause.Eq("id", 1),
      );

      expect(ml.logs.length).toEqual(1);
      expect(ml.logs[0]).toStrictEqual({
        query: `DELETE FROM t1 WHERE ${clause.Eq("id", 1).clause(1)}`,
        values: [1],
      });
    });

    test("deleteRow. sensitive", async () => {
      await deleteRowsForTest(
        {
          tableName: "t1",
        },
        clause.Eq("id", clause.sensitiveValue(1)),
      );

      expect(ml.logs.length).toEqual(1);
      expect(ml.logs[0]).toStrictEqual({
        query: `DELETE FROM t1 WHERE ${clause.Eq("id", 1).clause(1)}`,
        values: ["*"],
      });
    });

    test("deleteRow. logging disabled", async () => {
      clearLogLevels();
      await deleteRowsForTest(
        {
          tableName: "t1",
        },
        clause.Eq("id", 1),
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
      const options: LoadRowOptions = {
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
      const options: LoadRowsOptions = {
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
      const options: LoadEntOptions<User> = {
        fields,
        tableName,
        loaderFactory: new ObjectLoaderFactory({
          fields,
          tableName,
          key: "id",
        }),
        ent: User,
        context: ctx,
      };
      await loadEnt(ctx.getViewer(), 1, options);

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
      const options: LoadEntOptions<User> = {
        fields,
        tableName,
        loaderFactory: new ObjectLoaderFactory({
          fields,
          tableName,
          key: "id",
        }),
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
        "dataloader-cache-hit": 1,
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
        loaderFactory: new ObjectLoaderFactory({
          fields,
          tableName,
          key: "id",
        }),
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
        loaderFactory: new ObjectLoaderFactory({
          fields,
          tableName,
          key: "id",
        }),
        ent: User,
      });

      expect(ml.logs.length).toEqual(0);
    });

    test("loadEnt", async () => {
      const options: LoadEntOptions<User> = {
        fields,
        tableName,
        ent: User,
        loaderFactory: new ObjectLoaderFactory({
          fields,
          tableName,
          key: "id",
        }),
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
      const options: LoadEntOptions<User> = {
        fields,
        tableName,
        loaderFactory: new ObjectLoaderFactory({
          fields,
          tableName,
          key: "id",
        }),
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
}

describe("postgres", () => {
  commonTests();
});

describe("sqlite", () => {
  setupSqlite(`sqlite:///ent_logs_test.db`, () => [
    table(
      "t1",
      integer("id", { primaryKey: true }),
      text("col1"),
      text("col2"),
    ),
    table(
      "users",
      integer("id", { primaryKey: true }),
      text("col1"),
      text("col2"),
    ),
  ]);

  commonTests();
});
