import DB, { Dialect } from "../../core/db";
import { Client } from "pg";
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

describe("postgres cleanup", () => {
  const admin = new Client({
    host: "localhost",
    database: "postgres",
    user: process.env.POSTGRES_USER || "",
    password: process.env.POSTGRES_PASSWORD || "",
  });
  const databases: TempDB[] = [];
  const exists = async (name: string) =>
    (await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]))
      .rowCount !== 0;
  const makeDB = () => {
    const db = new TempDB(Dialect.Postgres, []);
    databases.push(db);
    return db;
  };
  beforeAll(() => admin.connect());
  afterEach(async () => {
    jest.restoreAllMocks();
    await Promise.all(databases.splice(0).map((db) => db.afterAll()));
  });
  afterAll(() => admin.end());

  test("failed runtime initialization cleans up without touching the previous pool", async () => {
    const previous = makeDB();
    await previous.beforeAll();
    const previousRuntime = DB.getInstance();
    const failure = new Error("runtime initialization failed");
    jest.spyOn(DB, "initDB").mockImplementationOnce(() => {
      throw failure;
    });
    const db = makeDB();
    await expect(db.beforeAll()).rejects.toBe(failure);
    expect(await exists(db.getDB())).toBe(false);
    expect(
      (await previousRuntime.getPool().query("SELECT 42 AS value")).rows[0]
        .value,
    ).toBe(42);
    await db.afterAll();
  });

  test("a failed table definition is cleaned up before setup rejects", async () => {
    const db = new TempDB(Dialect.Postgres, [
      {
        name: "invalid",
        create: () => "CREATE TABLE invalid (id nonexistent_type)",
        drop: () => "DROP TABLE invalid",
      },
    ]);
    databases.push(db);
    await expect(db.beforeAll()).rejects.toThrow(
      'type "nonexistent_type" does not exist',
    );
    expect(await exists(db.getDB())).toBe(false);
    await db.afterAll();
  });

  test.each([
    true,
    false,
  ])("cleanup releases an outstanding pool lease (automatic setup: %s)", async (automatic) => {
    const db = makeDB();
    await db.beforeAll(automatic);
    if (!automatic) {
      DB.initDB({ connectionString: `postgres://localhost/${db.getDB()}` });
      db.trackRuntimeDB();
    }
    const lease = await DB.getInstance().getNewClient();
    await db.afterAll();
    expect(await exists(db.getDB())).toBe(false);
    // Late caller cleanup must not release the same lease twice.
    await lease.release();
    await db.afterAll();
  });

  test("cleanup before setup does not initialize a runtime connection", async () => {
    const initialize = jest.spyOn(DB, "getInstance");
    await makeDB().afterAll();
    expect(initialize).not.toHaveBeenCalled();
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
