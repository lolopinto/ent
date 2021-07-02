import DB, { Client, Sqlite, SyncClient } from "./db";
import {
  integer,
  table,
  text,
  setupSqlite,
  timestamp,
  bool,
} from "../testutils/db/test_db";
import {
  createRowForTest,
  deleteRowsForTest,
  editRowForTest,
} from "../testutils/write";
import * as clause from "./clause";
import { loadConfig } from "./config";

describe("sqlite", () => {
  setupSqlite(`sqlite:///db.test.db`, () => [
    table(
      "users",
      integer("id", { primaryKey: true }),
      text("foo"),
      text("bar"),
    ),
    table("with_time", integer("id", { primaryKey: true }), timestamp("time")),
    table("with_bool", integer("id", { primaryKey: true }), bool("valid")),
  ]);

  test("create", async () => {
    await createRowForTest({
      fields: {
        id: 1,
        bar: "bar",
        foo: "foo",
      },
      tableName: "users",
    });

    const r = await DB.getInstance()
      .getPool()
      .query("SELECT * From users WHERE id = ?", [1]);

    expect(r).toEqual({
      rowCount: 1,
      rows: [{ id: 1, bar: "bar", foo: "foo" }],
    });
  });

  test("update", async () => {
    await createRowForTest({
      fields: {
        id: 1,
        bar: "bar",
        foo: "foo",
      },
      tableName: "users",
    });

    await editRowForTest(
      {
        fields: {
          bar: "bar2",
        },
        tableName: "users",
        key: "id",
      },
      1,
    );

    const r = await DB.getInstance()
      .getPool()
      .query("SELECT * From users WHERE id = ?", [1]);

    expect(r).toEqual({
      rowCount: 1,
      rows: [{ id: 1, bar: "bar2", foo: "foo" }],
    });
  });

  test("delete", async () => {
    await createRowForTest({
      fields: {
        id: 1,
        bar: "bar",
        foo: "foo",
      },
      tableName: "users",
    });

    await deleteRowsForTest(
      {
        tableName: "users",
      },
      clause.Eq("id", 1),
    );

    const r = await DB.getInstance()
      .getPool()
      .query("SELECT * From users WHERE id = ?", [1]);

    expect(r).toStrictEqual({ rowCount: 0, rows: [] });
  });

  function isSyncClient(client: Client): client is SyncClient {
    return (client as SyncClient).execSync !== undefined;
  }
  test("transaction", async () => {
    const client = await DB.getInstance().getNewClient();

    if (!isSyncClient(client)) {
      throw new Error("runInTransaction method not supported");
    }
    client.runInTransaction(() => {
      client.execSync(`INSERT INTO users (id, bar, foo) VALUES (?, ?, ?)`, [
        1,
        "bar",
        "foo",
      ]);
      client.execSync(`INSERT INTO users (id, bar, foo) VALUES (?, ?, ?)`, [
        2,
        "bar",
        "foo",
      ]);
    });

    const r = await DB.getInstance().getPool().queryAll("SELECT * FROM users");
    expect(r.rowCount).toBe(2);
    expect(r.rows.length).toBe(2);
    expect(r.rows).toEqual([
      { id: 1, foo: "foo", bar: "bar" },
      { id: 2, foo: "foo", bar: "bar" },
    ]);
  });

  // not the supported way?
  test("manual transactions", async () => {
    const client = await DB.getInstance().getSQLiteClient();

    client.execSync("BEGIN");
    client.execSync(`INSERT INTO users (id, bar, foo) VALUES (?, ?, ?)`, [
      1,
      "bar",
      "foo",
    ]);
    client.execSync(`INSERT INTO users (id, bar, foo) VALUES (?, ?, ?)`, [
      2,
      "bar2",
      "foo2",
    ]);
    client.execSync("COMMIT");

    await client.release();

    const r = await DB.getInstance().getPool().queryAll("SELECT * FROM users");
    expect(r).toEqual({
      rowCount: 2,
      rows: [
        { id: 1, foo: "foo", bar: "bar" },
        { id: 2, foo: "foo2", bar: "bar2" },
      ],
    });

    // count
    const r2 = await DB.getInstance()
      .getPool()
      .queryAll("SELECT count(1) as count FROM users");
    expect(r2).toEqual({
      rowCount: 1,
      rows: [{ count: 2 }],
    });
  });

  const throwbackErr = new Error(`rollback this transaction`);

  const createUsers = async (
    ids: number[],
    opts?: { checkRows?: boolean; rollback?: boolean },
  ) => {
    const client = await DB.getInstance().getSQLiteClient();

    client.runInTransaction(() => {
      ids.map(async (id) => {
        client.execSync(`INSERT INTO users (id, bar, foo) VALUES (?, ?, ?)`, [
          id,
          `bar${id}`,
          `foo${id}`,
        ]);
      });
      // we only check for the first one because of how sqlite transactions work
      // there's an argument to be made that we should alwas perform writes sequentially
      // to not deal with this
      if (opts?.checkRows) {
        const r = client.queryAllSync("SELECT * FROM users");
        expect(r).toEqual({
          rowCount: 3,
          rows: [
            { id: 1, foo: "foo1", bar: "bar1" },
            { id: 3, foo: "foo3", bar: "bar3" },
            { id: 5, foo: "foo5", bar: "bar5" },
          ],
        });
      }

      if (opts?.rollback) {
        throw throwbackErr;
      }
    });

    client.release();
  };

  test("mixed transactions", async () => {
    await Promise.all([
      createUsers([1, 3, 5], { checkRows: true }),
      createUsers([2, 4, 6]),
    ]);

    const r = await DB.getInstance().getPool().queryAll("SELECT * FROM users");
    expect(r).toEqual({
      rowCount: 6,
      rows: [
        { id: 1, foo: "foo1", bar: "bar1" },
        { id: 2, foo: "foo2", bar: "bar2" },
        { id: 3, foo: "foo3", bar: "bar3" },
        { id: 4, foo: "foo4", bar: "bar4" },
        { id: 5, foo: "foo5", bar: "bar5" },
        { id: 6, foo: "foo6", bar: "bar6" },
      ],
    });
  });

  test("rollback transaction", async () => {
    const client = await DB.getInstance().getSQLiteClient();

    try {
      await createUsers([1, 2], { rollback: true });
      fail("should have thrown");
    } catch (err) {
      expect(err).toEqual(throwbackErr);
    }

    const r = await DB.getInstance().getPool().queryAll("SELECT * FROM users");
    expect(r).toEqual({ rowCount: 0, rows: [] });
  });

  test("mixed rollback", async () => {
    try {
      await Promise.all([
        createUsers([1, 2, 3]),
        createUsers([4, 5, 6], { rollback: true }),
      ]);
    } catch (err) {
      expect(err).toEqual(throwbackErr);
    }

    const r = await DB.getInstance().getPool().queryAll("SELECT * FROM users");
    expect(r).toEqual({
      rowCount: 3,
      rows: [
        { id: 1, foo: "foo1", bar: "bar1" },
        { id: 2, foo: "foo2", bar: "bar2" },
        { id: 3, foo: "foo3", bar: "bar3" },
      ],
    });
  });

  test("time", async () => {
    const d = new Date();
    const client = await DB.getInstance().getSQLiteClient();
    client.execSync(`INSERT INTO with_time (id, time) VALUES(?,?)`, [1, d]);

    const r = await DB.getInstance()
      .getPool()
      .queryAll("SELECT id, time FROM with_time");

    expect(r).toEqual({
      rowCount: 1,
      rows: [{ id: 1, time: d.toISOString() }],
    });
  });

  test("query single", async () => {
    await createUsers([1, 2, 3, 4, 5, 6]);

    const r = await DB.getInstance()
      .getPool()
      .query("select * from users where id = ?", [1]);
    expect(r).toEqual({
      rowCount: 1,
      rows: [{ id: 1, foo: "foo1", bar: "bar1" }],
    });
  });

  test("query multi", async () => {
    await createUsers([1, 2, 3, 4, 5, 6]);

    const r = await DB.getInstance()
      .getPool()
      .queryAll("select * from users where id in (?,?)", [1, 2]);
    expect(r).toEqual({
      rowCount: 2,
      rows: [
        { id: 1, foo: "foo1", bar: "bar1" },
        { id: 2, foo: "foo2", bar: "bar2" },
      ],
    });
  });

  test("query multi args", async () => {
    await createUsers([1, 2, 3, 4, 5, 6]);

    const r = await DB.getInstance()
      .getPool()
      .queryAll("select * from users where id = ? and foo = ?", [1, "foo1"]);
    expect(r).toEqual({
      rowCount: 1,
      rows: [{ id: 1, foo: "foo1", bar: "bar1" }],
    });
  });

  test("query bool", async () => {
    const client = await DB.getInstance().getSQLiteClient();
    client.execSync(`INSERT INTO with_bool (id, valid) VALUES(?,?)`, [1, true]);
    client.execSync(`INSERT INTO with_bool (id, valid) VALUES(?,?)`, [
      2,
      false,
    ]);
    client.execSync(`INSERT INTO with_bool (id, valid) VALUES(?,?)`, [3, true]);
    client.execSync(`INSERT INTO with_bool (id, valid) VALUES(?,?)`, [
      4,
      false,
    ]);

    const r = await DB.getInstance()
      .getPool()
      .queryAll("SELECT id, valid FROM with_bool");

    expect(r).toEqual({
      rowCount: 4,
      rows: [
        { id: 1, valid: 1 },
        { id: 2, valid: 0 },
        { id: 3, valid: 1 },
        { id: 4, valid: 0 },
      ],
    });

    const r2 = await DB.getInstance()
      .getPool()
      .queryAll(
        "SELECT id, valid FROM with_bool WHERE id >= ? AND valid = ?",
        [1, 1],
      );
    expect(r2).toEqual({
      rowCount: 2,
      rows: [
        { id: 1, valid: 1 },
        { id: 3, valid: 1 },
      ],
    });

    const r3 = await DB.getInstance()
      .getPool()
      .queryAll(
        "SELECT id, valid FROM with_bool WHERE id >= ? AND valid = ?",
        [1, 0],
      );
    expect(r3).toEqual({
      rowCount: 2,
      rows: [
        { id: 2, valid: 0 },
        { id: 4, valid: 0 },
      ],
    });

    const r4 = await DB.getInstance()
      .getPool()
      .queryAll("SELECT id, valid FROM with_bool WHERE id >= ? AND valid = ?", [
        1,
        //        // we convert from true to 0
        true,
      ]);
    expect(r4).toEqual({
      rowCount: 2,
      rows: [
        { id: 1, valid: 1 },
        { id: 3, valid: 1 },
      ],
    });

    const r5 = await DB.getInstance()
      .getPool()
      .queryAll("SELECT id, valid FROM with_bool WHERE id >= ? AND valid = ?", [
        1,
        // we convert from false to 0
        false,
      ]);
    expect(r5).toEqual({
      rowCount: 2,
      rows: [
        { id: 2, valid: 0 },
        { id: 4, valid: 0 },
      ],
    });
  });
});

function validateSQLiteMemory(memory: boolean) {
  const conn = DB.getInstance().getConnection();
  expect((conn as Sqlite).db.memory).toBe(memory);
}

test("sqlite memory", async () => {
  // specify dialect as sqlite
  const connStr = `sqlite:///`;

  delete process.env.DB_CONNECTION_STRING;
  loadConfig(Buffer.from(`dbConnectionString: ${connStr}`));
  validateSQLiteMemory(true);

  const client = await DB.getInstance().getSQLiteClient();
  client.execSync(
    table(
      "users",
      integer("id", { primaryKey: true }),
      text("foo"),
      text("bar"),
    ).create(),
  );

  client.execSync(`INSERT INTO users (id, bar, foo) VALUES (?, ?, ?)`, [
    100,
    "bar",
    "foo",
  ]);
  const r = await client.queryAll("SELECT * FROM users");
  expect(r).toEqual({
    rowCount: 1,
    rows: [{ id: 100, bar: "bar", foo: "foo" }],
  });
});
