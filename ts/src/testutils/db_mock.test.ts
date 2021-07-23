import { QueryRecorder } from "./db_mock";
import { Pool } from "pg";
import { createRowForTest, deleteRowsForTest, editRowForTest } from "./write";
import { Data, ID } from "../core/base";
import { loadRow, loadRows } from "../core/ent";
import DB from "../core/db";
import * as clause from "../core/clause";
import { Where, EqOp } from "./parse_sql";
import { setLogLevels } from "../core/logger";
import { MockLogs } from "./mock_log";

jest.mock("pg");
QueryRecorder.mockPool(Pool);

beforeAll(() => {
  setLogLevels("error");
});

beforeEach(() => {});

afterEach(() => {
  QueryRecorder.clear();
  expect(QueryRecorder.getData().size).toBe(0);
});

function verifyRowWritten(
  fields: Data,
  tableName: string,
  length: number = 1,
  where?: Where,
) {
  let data = QueryRecorder.getData();
  expect(data.size).toBe(1);
  let list = data.get(tableName);
  expect(list).toBeDefined();
  expect(list!.length).toBe(length);
  let row: Data = {};
  if (where) {
    for (const item of list!) {
      if (where.apply(item)) {
        row = item;
        break;
      }
    }
  } else {
    row = list![0];
  }
  expect(row).toStrictEqual(fields);
}

function verifyIDRowWritten(fields: Data, id: ID, length: number = 10) {
  verifyRowWritten(fields, "t", length, new EqOp("id", id));
}

async function verifyRowDoesNotExist(id: ID, tableName: string = "t") {
  const row = await loadRow({
    tableName: tableName,
    clause: clause.Eq("id", id),
    fields: ["id", "name", "bar"],
  });
  expect(row).toBeNull();
}

const fields = {
  id: 1,
  bar: "bar$",
  baz: "baz",
};

const names = ["Jane", "John"];

async function createAll() {
  await Promise.all(
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(async (id) => {
      await createRowForTest({
        tableName: "t",
        fields: {
          id: id,
          bar: "bar",
          baz: "baz",
          name: names[id % 2],
        },
      });
    }),
  );
  expect(QueryRecorder.getData().size).toBe(1);
  expect(QueryRecorder.getData().get("t")!.length).toBe(10);
}

describe("insert", () => {
  test("simple insert", async () => {
    const result = await createRowForTest({
      tableName: "t",
      fields,
    });
    verifyRowWritten(fields, "t");
    expect(result).toBeNull();
  });

  test("returning *", async () => {
    const fields = {
      id: 1,
      bar: "bar$",
      baz: "baz",
    };
    const result = await createRowForTest(
      {
        tableName: "t",
        fields,
      },
      "RETURNING *",
    );
    verifyRowWritten(fields, "t");
    expect(result).toStrictEqual(fields);
  });

  test("returning cols", async () => {
    const fields = {
      id: 1,
      bar: "bar$",
      baz: "baz",
    };
    const result = await createRowForTest(
      {
        tableName: "t",
        fields,
      },
      "RETURNING id, bar",
    );
    verifyRowWritten(fields, "t");
    expect(result).toStrictEqual({
      id: 1,
      bar: "bar$",
    });
  });
});

describe("select", () => {
  const names = ["Jane", "John"];

  beforeEach(async () => {
    await createAll();
  });

  test("select 1", async () => {
    const row = await loadRow({
      tableName: "t",
      clause: clause.Eq("id", 2),
      fields: ["id", "name", "bar"],
    });
    expect(row).toStrictEqual({
      id: 2,
      name: "Jane",
      bar: "bar",
    });
  });

  test("select count(1)", async () => {
    const row = await loadRow({
      tableName: "t",
      clause: clause.Eq("id", 2),
      fields: ["count(1)"],
    });
    expect(row).toStrictEqual({ count: 1 });
  });

  test("select count(*)", async () => {
    const row = await loadRow({
      tableName: "t",
      clause: clause.Eq("id", 2),
      fields: ["count(*)"],
    });
    expect(row).toStrictEqual({ count: 1 });
  });

  test("select *", async () => {
    const pool = DB.getInstance().getPool();
    const result = await pool.query("SELECT * FROM t WHERE id = $1", [2]);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0]).toStrictEqual({
      id: 2,
      bar: "bar",
      baz: "baz",
      name: "Jane",
    });
  });

  test("select multiple", async () => {
    const rows = await loadRows({
      tableName: "t",
      fields: ["id", "bar", "name"],
      clause: clause.Eq("name", "Jane"),
    });
    const expected = [2, 4, 6, 8, 10].map((id) => {
      return { id, bar: "bar", name: "Jane" };
    });
    expect(expected).toStrictEqual(rows);
  });

  test("select count(1) multiple", async () => {
    const rows = await loadRows({
      tableName: "t",
      fields: ["count(1)"],
      clause: clause.Eq("name", "Jane"),
    });
    expect(rows).toStrictEqual([{ count: 5 }]);
  });

  test("select count(*) multiple", async () => {
    const rows = await loadRows({
      tableName: "t",
      fields: ["count(*)"],
      clause: clause.Eq("name", "Jane"),
    });
    expect(rows).toStrictEqual([{ count: 5 }]);
  });

  test("select limit", async () => {
    const rows = await loadRows({
      tableName: "t",
      fields: ["id", "bar", "name"],
      clause: clause.Eq("name", "Jane"),
      limit: 1,
    });
    expect(rows).toStrictEqual([{ id: 2, bar: "bar", name: "Jane" }]);
  });

  test("select count(1) + limit", async () => {
    const rows = await loadRows({
      tableName: "t",
      fields: ["count(1)"],
      clause: clause.Eq("name", "Jane"),
      limit: 1,
    });
    expect(rows).toStrictEqual([{ count: 5 }]);
  });

  test("select count(*) + limit", async () => {
    const rows = await loadRows({
      tableName: "t",
      fields: ["count(*)"],
      clause: clause.Eq("name", "Jane"),
      limit: 1,
    });
    expect(rows).toStrictEqual([{ count: 5 }]);
  });

  test("order by DESC", async () => {
    const rows = await loadRows({
      tableName: "t",
      fields: ["id", "bar", "name"],
      clause: clause.Eq("name", "Jane"),
      orderby: "id DESC",
      // default is ASC absence of it implies that
      // desc can be put on each row
    });
    const expected = [10, 8, 6, 4, 2].map((id) => {
      return { id, bar: "bar", name: "Jane" };
    });
    expect(expected).toStrictEqual(rows);
  });

  test("count(1) + order by", async () => {
    try {
      const pool = DB.getInstance().getPool();
      await pool.query(
        "SELECT count(1) FROM t WHERE name = $1 ORDER BY id desc",
        ["Jane"],
      );
      fail("should have thrown error");
    } catch (err) {
      expect(err.message).toMatch(/cannot do count and order by/);
    }
  });

  test("count(*) + order by", async () => {
    try {
      const pool = DB.getInstance().getPool();
      await pool.query(
        "SELECT count(*) FROM t WHERE name = $1 ORDER BY id desc",
        ["Jane"],
      );
      fail("should have thrown error");
    } catch (err) {
      expect(err.message).toMatch(/cannot do count and order by/);
    }
  });

  test("order by ASC", async () => {
    const rows = await loadRows({
      tableName: "t",
      fields: ["id", "bar", "name"],
      clause: clause.Eq("name", "John"),
      orderby: "id",
    });
    const expected = [1, 3, 5, 7, 9].map((id) => {
      return { id, bar: "bar", name: "John" };
    });
    expect(expected).toStrictEqual(rows);
  });

  test("order by multiple rows", async () => {
    const rows = await loadRows({
      tableName: "t",
      fields: ["id", "bar", "name"],
      clause: clause.Eq("bar", "bar"),
      orderby: "id, name",
    });
    // Janes first
    const expected = [2, 4, 6, 8, 10].map((id) => {
      return { id, bar: "bar", name: "Jane" };
    });
    // then the Johns
    [1, 3, 5, 7, 9].forEach((id) => {
      expected.push({ id, bar: "bar", name: "John" });
    });
    expect(expected).toStrictEqual(rows);
  });

  test("order by multiple rows different order", async () => {
    const rows = await loadRows({
      tableName: "t",
      fields: ["id", "bar", "name"],
      clause: clause.Eq("bar", "bar"),
      orderby: "id, name DESC",
    });
    // Johns first
    const expected = [1, 3, 5, 7, 9].map((id) => {
      return { id, bar: "bar", name: "John" };
    });
    // then the Janes
    [2, 4, 6, 8, 10].forEach((id) => {
      expected.push({ id, bar: "bar", name: "Jane" });
    });
    expect(expected).toStrictEqual(rows);
  });

  test("order by + limit", async () => {
    const rows = await loadRows({
      tableName: "t",
      fields: ["id", "bar", "name"],
      clause: clause.Eq("name", "Jane"),
      orderby: "id DESC",
      limit: 2,
    });
    const expected = [10, 8].map((id) => {
      return { id, bar: "bar", name: "Jane" };
    });
    expect(expected).toStrictEqual(rows);
  });

  test("no where clause", async () => {
    const pool = DB.getInstance().getPool();
    const result = await pool.query("SELECT * FROM t", []);
    const expected = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((id) => {
      return {
        id: id,
        bar: "bar",
        baz: "baz",
        name: names[id % 2],
      };
    });
    expect(expected).toStrictEqual(result.rows);
  });

  test("no where clause + specific columns", async () => {
    const pool = DB.getInstance().getPool();
    const result = await pool.query("SELECT id, name, bar FROM t", []);
    const expected = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((id) => {
      return {
        id: id,
        bar: "bar",
        name: names[id % 2],
      };
    });
    expect(expected).toStrictEqual(result.rows);
  });

  test("no where clause + count(*)", async () => {
    const pool = DB.getInstance().getPool();
    const result = await pool.query("SELECT count(*) FROM t", []);
    expect([{ count: 10 }]).toStrictEqual(result.rows);
  });

  test("no where clause + count(1)", async () => {
    const pool = DB.getInstance().getPool();
    const result = await pool.query("SELECT count(1) FROM t", []);
    expect([{ count: 10 }]).toStrictEqual(result.rows);
  });

  test("no where clause + order by name", async () => {
    const pool = DB.getInstance().getPool();
    const result = await pool.query("SELECT * FROM t ORDER BY name", []);
    // Janes
    const expected = [2, 4, 6, 8, 10].map((id) => {
      return { id, bar: "bar", baz: "baz", name: "Jane" };
    });
    // then the Johns
    [1, 3, 5, 7, 9].forEach((id) => {
      expected.push({ id, bar: "bar", baz: "baz", name: "John" });
    });
    expect(expected).toStrictEqual(result.rows);
  });

  test("no where clause + LIMIT 4", async () => {
    const pool = DB.getInstance().getPool();
    const result = await pool.query("SELECT * FROM t LIMIT 4", []);
    const expected = [1, 2, 3, 4].map((id) => {
      return {
        id: id,
        bar: "bar",
        baz: "baz",
        name: names[id % 2],
      };
    });
    expect(expected).toStrictEqual(result.rows);
  });

  test("no where clause + order by name + limit", async () => {
    const pool = DB.getInstance().getPool();
    const result = await pool.query(
      "SELECT * FROM t ORDER BY name LIMIT 6",
      [],
    );
    // Janes
    const expected = [2, 4, 6, 8, 10].map((id) => {
      return { id, bar: "bar", baz: "baz", name: "Jane" };
    });
    // then the one John
    [1].forEach((id) => {
      expected.push({ id, bar: "bar", baz: "baz", name: "John" });
    });
    expect(expected).toStrictEqual(result.rows);
  });

  test("groupby", async () => {
    const ml = new MockLogs();
    ml.mock();

    // TODO loadRowsX
    await loadRows({
      tableName: "t",
      fields: ["count(1)", "name"],
      clause: clause.Eq("name", "Jane"),
      //      orderby: "id DESC",
      groupby: "name",
      limit: 2,
    });
    ml.restore();
    expect(ml.errors.length).toBe(1);

    // we currently hide errors so we have to do this nonsense instead
    expect(ml.errors[0]).toMatch(/^non-null groupby/);
  });
});

describe("ops", () => {
  beforeEach(async () => {
    await createAll();
  });

  test("=", async () => {
    const row = await loadRow({
      tableName: "t",
      clause: clause.Eq("id", 2),
      fields: ["id", "name", "bar"],
    });
    expect(row).toStrictEqual({
      id: 2,
      name: "Jane",
      bar: "bar",
    });
  });

  test("IN", async () => {
    const rows = await loadRows({
      tableName: "t",
      clause: clause.In("id", 2, 4, 6, 8, 10),
      fields: ["id", "name", "bar"],
    });
    const expected = [2, 4, 6, 8, 10].map((id) => {
      return { id, bar: "bar", name: "Jane" };
    });
    expect(rows).toStrictEqual(expected);
  });

  test(">", async () => {
    const rows = await loadRows({
      tableName: "t",
      clause: clause.Greater("id", 5),
      fields: ["id", "bar", "baz"],
    });
    const expected = [6, 7, 8, 9, 10].map((id) => {
      return { id, bar: "bar", baz: "baz" };
    });

    expect(rows).toStrictEqual(expected);
  });

  test("<", async () => {
    const rows = await loadRows({
      tableName: "t",
      clause: clause.Less("id", 5),
      fields: ["id", "bar", "baz"],
    });
    const expected = [1, 2, 3, 4].map((id) => {
      return { id, bar: "bar", baz: "baz" };
    });

    expect(rows).toStrictEqual(expected);
  });

  test(">=", async () => {
    const rows = await loadRows({
      tableName: "t",
      clause: clause.GreaterEq("id", 5),
      fields: ["id", "bar", "baz"],
    });
    const expected = [5, 6, 7, 8, 9, 10].map((id) => {
      return { id, bar: "bar", baz: "baz" };
    });

    expect(rows).toStrictEqual(expected);
  });

  test("<=", async () => {
    const rows = await loadRows({
      tableName: "t",
      clause: clause.LessEq("id", 5),
      fields: ["id", "bar", "baz"],
    });
    const expected = [1, 2, 3, 4, 5].map((id) => {
      return { id, bar: "bar", baz: "baz" };
    });

    expect(rows).toStrictEqual(expected);
  });

  test("AND 2 ops", async () => {
    await Promise.all(
      [4, 8].map(async (id) => {
        return await editRowForTest(
          {
            tableName: "t",
            fields: {
              bar: "bar2",
              baz: "baz3",
            },
            key: "id",
          },
          id,
        );
      }),
    );
    const rows = await loadRows({
      tableName: "t",
      clause: clause.And(clause.Eq("bar", "bar2"), clause.Eq("baz", "baz3")),
      fields: ["id", "name", "bar"],
    });
    const expected = [4, 8].map((id) => {
      return { id, bar: "bar2", name: "Jane" };
    });
    expect(rows).toStrictEqual(expected);
  });

  // TODO and 4 ops
  // TODO or and we're good for now

  test("AND 3 ops", async () => {
    await Promise.all(
      [4, 8].map(async (id) => {
        return await editRowForTest(
          {
            tableName: "t",
            fields: {
              bar: "bar2",
              baz: "baz3",
            },
            key: "id",
          },
          id,
        );
      }),
    );
    const rows = await loadRows({
      tableName: "t",
      clause: clause.And(
        clause.Eq("bar", "bar2"),
        clause.Eq("baz", "baz3"),
        clause.Greater("id", 4),
      ),
      fields: ["id", "name", "bar"],
    });
    const expected = [8].map((id) => {
      return { id, bar: "bar2", name: "Jane" };
    });
    expect(rows).toStrictEqual(expected);
  });

  test("OR 2 ops", async () => {
    const rows = await loadRows({
      tableName: "t",
      clause: clause.Or(clause.Greater("id", 7), clause.Less("id", 3)),
      fields: ["id", "name", "bar"],
    });
    const expected = [1, 2, 8, 9, 10].map((id) => {
      return { id, bar: "bar", name: names[id % 2] };
    });
    expect(rows).toStrictEqual(expected);
  });

  test("OR 3 ops", async () => {
    const rows = await loadRows({
      tableName: "t",
      clause: clause.Or(
        clause.Greater("id", 7),
        clause.Less("id", 3),
        clause.Eq("name", "Jane"),
      ),
      fields: ["id", "name", "bar"],
    });
    const expected = [1, 2, 4, 6, 8, 9, 10].map((id) => {
      return { id, bar: "bar", name: names[id % 2] };
    });
    expect(rows).toStrictEqual(expected);
  });

  test("OR 4 ops", async () => {
    await Promise.all(
      [4, 8].map(async (id) => {
        return await editRowForTest(
          {
            tableName: "t",
            fields: {
              bar: "bar2",
              baz: "baz3",
            },
            key: "id",
          },
          id,
        );
      }),
    );
    const rows = await loadRows({
      tableName: "t",
      clause: clause.Or(
        clause.Greater("id", 7), // 8,9,10
        clause.Less("id", 3), //1,2
        clause.Eq("name", "John"), // odds
        clause.Eq("bar", "bar2"), // 4, 8
      ),
      fields: ["id", "name", "bar"],
    });
    // basically everything but 6
    const expected = [1, 2, 3, 4, 5, 7, 8, 9, 10].map((id) => {
      return {
        id,
        bar: id == 4 || id == 8 ? "bar2" : "bar",
        name: names[id % 2],
      };
    });
    expect(rows).toStrictEqual(expected);
  });
});

describe("update", () => {
  beforeEach(async () => {
    await createAll();
  });

  test("simple update", async () => {
    const row = await editRowForTest(
      {
        tableName: "t",
        fields: {
          bar: "bar2",
        },
        key: "id",
      },
      1,
    );
    expect(row).toBeNull();
    verifyIDRowWritten({ id: 1, bar: "bar2", baz: "baz", name: "John" }, 1);
  });

  test("returning *", async () => {
    const row = await editRowForTest(
      {
        tableName: "t",
        fields: {
          bar: "bar2",
        },
        key: "id",
      },
      1,
      "RETURNING *",
    );
    expect(row).toStrictEqual({ id: 1, bar: "bar2", baz: "baz", name: "John" });
    verifyIDRowWritten({ id: 1, bar: "bar2", baz: "baz", name: "John" }, 1);
  });

  test("returning cols", async () => {
    const row = await editRowForTest(
      {
        tableName: "t",
        fields: {
          bar: "bar2",
        },
        key: "id",
      },
      1,
      "RETURNING id, bar",
    );
    expect(row).toStrictEqual({ id: 1, bar: "bar2" });
    verifyIDRowWritten({ id: 1, bar: "bar2", baz: "baz", name: "John" }, 1);
  });

  test("update multiple", async () => {
    const pool = DB.getInstance().getPool();
    const result = await pool.query(
      "UPDATE t SET name = $1 WHERE name = $2 RETURNING *",
      ["John2", "John"],
    );

    const expected = [1, 3, 5, 7, 9].map((id) => {
      return { id, bar: "bar", baz: "baz", name: "John2" };
    });
    expect(result.rows).toStrictEqual(expected);
  });

  test("update none", async () => {
    const pool = DB.getInstance().getPool();
    const result = await pool.query(
      "UPDATE t SET name = $1 WHERE name = $2 RETURNING *",
      ["John", "John2"],
    );

    expect(result.rows).toStrictEqual([]);
  });

  test("no where", async () => {
    const pool = DB.getInstance().getPool();
    const result = await pool.query("UPDATE t SET name = $1 RETURNING *", [
      "John2",
    ]);

    const expected = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((id) => {
      return { id, bar: "bar", baz: "baz", name: "John2" };
    });
    expect(result.rows).toStrictEqual(expected);
  });
});

describe("delete", () => {
  beforeEach(async () => {
    await createAll();
  });

  test("simple delete", async () => {
    const row = await deleteRowsForTest(
      {
        tableName: "t",
      },
      clause.Eq("id", 1),
    );
    expect(row).toBeUndefined();
    await verifyRowDoesNotExist(1);
  });

  test("delete multiple", async () => {
    const row = await deleteRowsForTest(
      {
        tableName: "t",
      },
      clause.Eq("name", "Jane"),
    );
    expect(row).toBeUndefined();
    expect(QueryRecorder.getData().size).toBe(1);
    expect(QueryRecorder.getData().get("t")!.length).toBe(5);
  });

  test("delete all", async () => {
    const pool = DB.getInstance().getPool();
    const result = await pool.query("DELETE from t");
    expect(result).toBeUndefined();
    expect(QueryRecorder.getData().size).toBe(1);
    expect(QueryRecorder.getData().get("t")!.length).toBe(0);
  });
});
