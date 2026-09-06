import * as clause from "./clause";
import { QueryableDataOptions } from "./base";
import { loadConfig } from "./config";
import DB, { Dialect } from "./db";
import { buildQuery, buildQueryData, getOrderByKey } from "./query_impl";

function distanceExpression(key: string) {
  return clause.ParameterizedExpression(
    key,
    (idx, alias) =>
      `distance(${alias ? `${alias}.location` : "location"}, $${idx}, $${idx + 1})`,
    [12.3, 45.6],
  );
}

describe("query_impl computed expressions", () => {
  test("buildQueryData includes computed select and order expressions", () => {
    const queryData = buildQueryData({
      tableName: "places",
      alias: "p",
      fields: [
        "id",
        { alias: "distance", expression: distanceExpression("d") },
      ],
      clause: clause.Eq("active", true),
      orderby: [
        {
          column: "distance",
          direction: "ASC",
          expression: distanceExpression("d"),
        },
      ],
      limit: 5,
    });

    expect(queryData.query).toBe(
      "SELECT p.id, distance(p.location, $1, $2) AS distance FROM places AS p WHERE p.active = $3 ORDER BY distance(p.location, $4, $5) ASC LIMIT 5",
    );
    expect(queryData.values).toEqual([12.3, 45.6, true, 12.3, 45.6]);
    expect(queryData.logValues).toEqual([12.3, 45.6, true, 12.3, 45.6]);
  });

  test("order by keys use expression instance keys", () => {
    expect(
      getOrderByKey([
        {
          column: "distance",
          direction: "ASC",
          expression: distanceExpression("same"),
        },
      ]),
    ).toBe(
      getOrderByKey([
        {
          column: "distance",
          direction: "ASC",
          expression: distanceExpression("same"),
        },
      ]),
    );

    expect(
      getOrderByKey([
        {
          column: "distance",
          direction: "ASC",
          expression: distanceExpression("same"),
        },
      ]),
    ).not.toBe(
      getOrderByKey([
        {
          column: "distance",
          direction: "ASC",
          expression: distanceExpression("different"),
        },
      ]),
    );
  });
});

describe.each([
  Dialect.Postgres,
  Dialect.SQLite,
])("%s query offsets", (dialect) => {
  beforeAll(() => {
    loadConfig({
      dbConnectionString:
        dialect === Dialect.Postgres
          ? "postgres://localhost/ent_test"
          : "sqlite:///",
    });
  });

  afterAll(async () => {
    await DB.getInstance().endPool();
  });

  test.each([
    1, 7,
  ])("select, join, where, and order by start at %i", (startIdx) => {
    const options: QueryableDataOptions = {
      tableName: "contacts",
      alias: "c",
      fields: [
        "id",
        { alias: "selected", expression: clause.Eq("name", "selected name") },
      ],
      join: [
        { tableName: "owners", alias: "o", clause: clause.Eq("id", 42, "o") },
      ],
      clause: clause.And(
        clause.Eq("name", "O'Brien"),
        clause.Eq("active", true),
      ),
      orderby: [
        {
          column: "name",
          direction: "ASC",
          expression: clause.Eq("name", clause.sensitiveValue("private")),
        },
      ],
    };
    const p = (offset: number) =>
      dialect === Dialect.Postgres ? `$${startIdx + offset}` : "?";
    const result = buildQueryData(options, startIdx);
    expect(result.query).toBe(
      `SELECT c.id, c.name = ${p(0)} AS selected FROM contacts AS c JOIN owners o ON o.id = ${p(1)} WHERE c.name = ${p(2)} AND c.active = ${p(3)} ORDER BY c.name = ${p(4)} ASC`,
    );
    expect(buildQuery(options, startIdx)).toBe(result.query);
    expect(result.values).toEqual([
      "selected name",
      42,
      "O'Brien",
      true,
      "private",
    ]);
    expect(result.logValues).toEqual([
      "selected name",
      42,
      "O'Brien",
      true,
      "*******",
    ]);
  });

  test.each([
    1, 7,
  ])("nested select subqueries start at %i", async (startIdx) => {
    const subquery = (options: QueryableDataOptions) => {
      const data = buildQueryData(options);
      return clause.ParameterizedExpression(
        "nested query",
        (idx) => `(${buildQuery(options, idx)})`,
        data.values,
        data.logValues,
      );
    };
    const inner = subquery({
      tableName: "contacts",
      alias: "i",
      fields: [{ alias: "matches", expression: clause.Eq("name", "O'Brien") }],
      clause: clause.Eq("id", 3),
    });
    const middle = subquery({
      tableName: "contacts",
      alias: "m",
      fields: [{ alias: "matches", expression: inner }],
      clause: clause.Eq("id", 2),
    });
    const options: QueryableDataOptions = {
      tableName: "contacts",
      alias: "c",
      fields: [
        { alias: "selected", expression: clause.Eq("name", "selected") },
        { alias: "nested", expression: middle },
        { alias: "sibling", expression: inner },
      ],
      clause: clause.Eq("id", 1),
    };
    const p = (offset: number) =>
      dialect === Dialect.Postgres ? `$${startIdx + offset}` : "?";
    const result = buildQueryData(options, startIdx);
    expect(result.query).toBe(
      `SELECT c.name = ${p(0)} AS selected, (SELECT (SELECT i.name = ${p(1)} AS matches FROM contacts AS i WHERE i.id = ${p(2)}) AS matches FROM contacts AS m WHERE m.id = ${p(3)}) AS nested, (SELECT i.name = ${p(4)} AS matches FROM contacts AS i WHERE i.id = ${p(5)}) AS sibling FROM contacts AS c WHERE c.id = ${p(6)}`,
    );
    expect(result.values).toEqual([
      "selected",
      "O'Brien",
      3,
      2,
      "O'Brien",
      3,
      1,
    ]);
    expect(result.logValues).toEqual(result.values);
    if (dialect === Dialect.SQLite) {
      const pool = DB.getInstance().getSQLiteClient();
      pool.execSync(
        "CREATE TABLE IF NOT EXISTS contacts (id INTEGER PRIMARY KEY, name TEXT)",
      );
      pool.execSync("DELETE FROM contacts");
      for (const [id, name] of [
        [1, "selected"],
        [2, "middle"],
        [3, "O'Brien"],
      ]) {
        pool.execSync("INSERT INTO contacts (id, name) VALUES (?, ?)", [
          id,
          name,
        ]);
      }
      expect((await pool.queryAll(result.query, result.values)).rows).toEqual([
        { selected: 1, nested: 1, sibling: 1 },
      ]);
    }
  });
});
