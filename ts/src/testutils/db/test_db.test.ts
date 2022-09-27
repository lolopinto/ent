import { Dialect } from "../../core/db";
import { TempDB, text, table, uuid } from "./temp_db";

const fkeyTables = () => {
  return [
    table("users", uuid("id", { primaryKey: true }), text("first_name")),
    table(
      "contacts",
      uuid("id", { primaryKey: true }),
      uuid("user_id", {
        foreignKey: {
          table: "users",
          col: "id",
        },
      }),
      text("first_name"),
    ),
  ];
};

describe("postgres", () => {
  test("fkey", async () => {
    let tdb: TempDB;
    tdb = new TempDB(Dialect.Postgres, fkeyTables());
    await tdb.beforeAll();
    await tdb.afterAll();
  });
});

describe("sqlite", () => {
  beforeAll(() => {
    process.env.DB_CONNECTION_STRING = "sqlite:///";
  });

  test("basic fkey", async () => {
    let tdb = new TempDB(Dialect.SQLite, [
      table("users", uuid("id", { primaryKey: true }), text("first_name")),
      table(
        "contacts",
        uuid("id", { primaryKey: true }),
        uuid("user_id", {
          foreignKey: {
            table: "users",
            col: "id",
          },
        }),
        text("first_name"),
      ),
    ]);

    expect(tdb.getDialect()).toBe(Dialect.SQLite);

    await tdb.beforeAll();
    expect(tdb.__getTables().size).toBe(2);

    await tdb.afterAll();
  });
});
