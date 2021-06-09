// TODO sqlite tests

//reads, writes
//transactions
import DB from "./db";
import {
  integer,
  table,
  text,
  setupSqlite,
  assoc_edge_config_table,
} from "../testutils/db/test_db";
import {
  createRowForTest,
  deleteRowsForTest,
  editRowForTest,
} from "../testutils/write";
import * as clause from "./clause";

describe("sqlite", () => {
  setupSqlite(`sqlite:///db.test.db`, () => [
    table(
      "users",
      integer("id", { primaryKey: true }),
      text("foo"),
      text("bar"),
    ),
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

    const row = r.rows[0];
    expect(row.id).toBe(1);
    expect(row.bar).toBe("bar");
    expect(row.foo).toBe("foo");
    // /    expect(row).toStrictEqual({ id: 1, bar: "bar", foo: "foo" });
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

    const row = r.rows[0];
    expect(row.id).toBe(1);
    expect(row.bar).toBe("bar2");
    expect(row.foo).toBe("foo");
    // /    expect(row).toStrictEqual({ id: 1, bar: "bar2", foo: "foo" });
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

  // TODO
  test("transaction", async () => {
    const client = await DB.getInstance().getNewClient();

    await client.runTransaction(() => {
      client.exec(`INSERT INTO users (id, bar, foo) VALUES (?, ?, ?)`, [
        1,
        "bar",
        "foo",
      ]);
      client.exec(`INSERT INTO users (id, bar, foo) VALUES (?, ?, ?)`, [
        2,
        "bar",
        "foo",
      ]);
    });

    client.release();

    const r = await DB.getInstance().getPool().queryAll("SELECT * FROM users");
    expect(r.rowCount).toBe(2);
    expect(r.rows.length).toBe(2);
    expect(r.rows).toEqual([
      { id: 1, foo: "foo", bar: "bar" },
      { id: 2, foo: "foo", bar: "bar" },
    ]);
  });

  test("manual transactions", async () => {
    const client = await DB.getInstance().getNewClient();

    await client.begin();
    await client.exec(`INSERT INTO users (id, bar, foo) VALUES (?, ?, ?)`, [
      1,
      "bar",
      "foo",
    ]);
    await client.exec(`INSERT INTO users (id, bar, foo) VALUES (?, ?, ?)`, [
      2,
      "bar2",
      "foo2",
    ]);
    await client.commit();

    client.release();

    const r = await DB.getInstance().getPool().queryAll("SELECT * FROM users");
    expect(r.rowCount).toBe(2);
    expect(r.rows.length).toBe(2);
    expect(r.rows).toEqual([
      { id: 1, foo: "foo", bar: "bar" },
      { id: 2, foo: "foo2", bar: "bar2" },
    ]);
  });

  const createUsers = async (ids: number[]) => {
    const client = await DB.getInstance().getNewClient();

    await client.begin();
    ids.map(async (id) => {
      await client.exec(`INSERT INTO users (id, bar, foo) VALUES (?, ?, ?)`, [
        id,
        `bar${id}`,
        `foo${id}`,
      ]);
    });

    await client.commit();

    client.release();
  };

  // TODO load row in transaction in this test
  test("mixed transactions", async () => {
    await Promise.all([createUsers([1, 3, 5]), createUsers([2, 4, 6])]);

    const r = await DB.getInstance().getPool().queryAll("SELECT * FROM users");
    expect(r.rowCount).toBe(6);
    expect(r.rows.length).toBe(6);
    expect(r.rows).toEqual([
      { id: 1, foo: "foo1", bar: "bar1" },
      { id: 2, foo: "foo2", bar: "bar2" },
      { id: 3, foo: "foo3", bar: "bar3" },
      { id: 4, foo: "foo4", bar: "bar4" },
      { id: 5, foo: "foo5", bar: "bar5" },
      { id: 6, foo: "foo6", bar: "bar6" },
    ]);
  });

  // doesn't work because of the event loop. how this works
  // TODO would have to rewrite things to get this to work
  test.skip("rollback transaction", async () => {
    const client = await DB.getInstance().getNewClient();

    await client.begin();
    await client.exec(`INSERT INTO users (id, bar, foo) VALUES (?, ?, ?)`, [
      1,
      "bar",
      "foo",
    ]);
    await client.exec(`INSERT INTO users (id, bar, foo) VALUES (?, ?, ?)`, [
      2,
      "bar2",
      "foo2",
    ]);
    await client.rollback();

    client.release();

    const r = await DB.getInstance().getPool().queryAll("SELECT * FROM users");
    expect(r.rowCount).toBe(0);
    expect(r.rows.length).toBe(0);
    expect(r.rows).toEqual([]);
  });
});
