import { Dialect } from "../../core/db";
import {
  TempDB,
  text,
  table,
  uuid,
  timestamp,
  timestamptz,
  timetz,
  time,
  date,
  bool,
} from "./test_db";

test("fkey", async () => {
  let tdb: TempDB;
  try {
    tdb = new TempDB([
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
    await tdb.beforeAll();
  } catch (err) {
    fail(err);
  } finally {
    await tdb!.afterAll();
  }
});

// TODO fkey sqlite
test("sqlite", async () => {
  process.env.DB_CONNECTION_STRING = "sqlite:///";

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
  expect(tdb.getTables().size).toBe(2);

  await tdb.beforeAll();
  await tdb.afterAll();
});

// TODO different types
// https://www.sqlite.org/lang_datefunc.html
let supportedPostgresTypes = [
  uuid("id"),
  text("name"),
  timestamp("created_at"),
  timestamptz("updated_at"),
  timetz("start_time"),
  time("end_time"),
  date("date"),
  bool("happy"),
];

let supportedSqliteTypes = [
  text("name"),
  // timestamp("created_at"),
  // timestamptz("updated_at"),
  // timetz("start_time"),
  // time("end_time"),
  // date("date"),
  bool("happy"),
];
