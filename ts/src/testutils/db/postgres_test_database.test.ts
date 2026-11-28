import { randomBytes } from "crypto";
import { Client } from "pg";
import DB from "../../core/db";
import { PostgresTestDatabase } from "./postgres_test_database";

const admin = new Client({
  host: "localhost",
  user: process.env.POSTGRES_USER || "",
  password: process.env.POSTGRES_PASSWORD || "",
  database: "postgres",
});
const owned: PostgresTestDatabase[] = [];
const clients: Client[] = [];

async function create(name?: string) {
  const database = new PostgresTestDatabase(name);
  owned.push(database);
  await database.create();
  return database;
}
async function connect(database: PostgresTestDatabase) {
  const client = new Client({
    ...database.connection,
    database: database.name,
  });
  // These intentionally leaked test connections may be terminated by cleanup.
  client.on("error", () => {});
  clients.push(client);
  await client.connect();
  return client;
}
async function oid(name: string) {
  return (
    await admin.query("SELECT oid FROM pg_database WHERE datname = $1", [name])
  ).rows[0]?.oid;
}
function runtimeURL(name: string) {
  const url = new URL("postgres://localhost:5432/");
  url.username = admin.user || "";
  url.password = process.env.POSTGRES_PASSWORD || "";
  url.pathname = name;
  return url.toString();
}

beforeAll(() => admin.connect());
afterEach(async () => {
  jest.restoreAllMocks();
  await Promise.all(clients.splice(0).map((client) => client.end()));
  await Promise.all(
    owned.splice(0).map((database) => database.close().catch(() => {})),
  );
});
afterAll(() => admin.end());

test("a name collision preserves the existing database, data, and session", async () => {
  const sentinel = await create();
  const connection = await connect(sentinel);
  await connection.query("CREATE TABLE sentinel (value text)");
  await connection.query("INSERT INTO sentinel VALUES ('keep')");
  const originalOID = await oid(sentinel.name);
  const collision = new PostgresTestDatabase(sentinel.name);
  await expect(collision.create()).rejects.toMatchObject({ code: "42P04" });
  await collision.close();
  expect(await oid(sentinel.name)).toBe(originalOID);
  expect((await connection.query("SELECT * FROM sentinel")).rows).toEqual([
    { value: "keep" },
  ]);
});

test("cleanup refuses a replacement database with the same name", async () => {
  const original = await create();
  const originalOID = await oid(original.name);
  DB.initDB({ db: { ...original.connection, database: original.name } });
  const runtime = DB.getInstance();
  original.trackRuntimeDB(runtime);
  // Only replace a database created by this test, never a pre-existing name.
  await admin.query(`DROP DATABASE "${original.name}"`);
  const replacement = await create(original.name);
  const connection = await connect(replacement);
  replacement.trackRuntimeDB(runtime);
  await runtime.getPool().query("SELECT 1");
  expect(await oid(original.name)).not.toBe(originalOID);
  await expect(original.close()).rejects.toThrow("Refusing to drop replaced");
  expect(
    (await runtime.getPool().query("SELECT 42 AS value")).rows[0].value,
  ).toBe(42);
  expect((await connection.query("SELECT 42 AS value")).rows[0].value).toBe(42);
});

test("cleanup terminates sessions only in the owned database and is idempotent", async () => {
  const sentinel = await create();
  const sentinelConnection = await connect(sentinel);
  const database = await create();
  expect(() => database.trackClient(sentinelConnection)).toThrow(
    "outside this test database",
  );
  await connect(database);
  await Promise.all([database.close(), database.close()]);
  expect(await oid(database.name)).toBeUndefined();
  expect(
    (await sentinelConnection.query("SELECT 42 AS value")).rows[0].value,
  ).toBe(42);
});

test.each([
  "reject",
  "timeout",
])("a connection %s does not prevent database cleanup", async (mode) => {
  const database = await create();
  const client = await connect(database);
  database.trackClient(client);
  jest
    .spyOn(client, "end")
    .mockImplementationOnce(() =>
      mode === "reject"
        ? Promise.reject(new Error("close failed"))
        : new Promise<void>(() => {}),
    );
  await expect(database.close()).rejects.toThrow(
    mode === "reject" ? "close failed" : "timed out",
  );
  expect(await oid(database.name)).toBeUndefined();
});

test("cleanup does not close a different runtime database", async () => {
  const sentinel = await create();
  DB.initDB({ db: { ...sentinel.connection, database: sentinel.name } });
  const runtime = DB.getInstance();
  sentinel.trackRuntimeDB(runtime);
  const database = await create();
  database.trackRuntimeDB(runtime);
  await database.close();
  expect(
    (await runtime.getPool().query("SELECT 42 AS value")).rows[0].value,
  ).toBe(42);
});

test.each(["%2F", "%3F", "%23"])(
  "cleanup preserves a different pool whose database name contains %s",
  async (escape) => {
    const prefix = `ent_test_${randomBytes(8).toString("hex")}`;
    const database = await create(prefix + decodeURIComponent(escape));
    const sentinel = await create(prefix + escape);
    const originalOID = await oid(sentinel.name);
    DB.initDB({ connectionString: runtimeURL(sentinel.name) });
    const runtime = DB.getInstance();
    const endPool = jest.spyOn(runtime, "endPool");
    try {
      await runtime.getPool().query("CREATE TABLE sentinel (value text)");
      await runtime.getPool().query("INSERT INTO sentinel VALUES ('keep')");
      const session = await runtime
        .getPool()
        .query("SELECT current_database(), pg_backend_pid()");
      expect(session.rows[0].current_database).toBe(sentinel.name);
      database.trackRuntimeDB(runtime);

      await database.close();

      expect(endPool).not.toHaveBeenCalled();
      expect(await oid(database.name)).toBeUndefined();
      expect(await oid(sentinel.name)).toBe(originalOID);
      expect(
        (await runtime.getPool().query("SELECT * FROM sentinel")).rows,
      ).toEqual([{ value: "keep" }]);
      expect(
        (
          await runtime
            .getPool()
            .query("SELECT current_database(), pg_backend_pid()")
        ).rows,
      ).toEqual(session.rows);
    } finally {
      await runtime.endPool().catch(() => {});
    }
  },
);

test.each(["%2F", "%3F", "%23"])(
  "cleanup closes its own pool when the database name contains %s",
  async (escape) => {
    const database = await create(
      `ent_test_${randomBytes(8).toString("hex")}${escape}`,
    );
    DB.initDB({ connectionString: runtimeURL(database.name) });
    const runtime = DB.getInstance();
    const endPool = jest.spyOn(runtime, "endPool");
    try {
      expect(
        (await runtime.getPool().query("SELECT current_database()")).rows[0]
          .current_database,
      ).toBe(database.name);
      database.trackRuntimeDB(runtime);

      await database.close();

      expect(endPool).toHaveBeenCalledTimes(1);
      expect(await oid(database.name)).toBeUndefined();
    } finally {
      await runtime.endPool().catch(() => {});
    }
  },
);

test("rejects names PostgreSQL would truncate before connecting", () => {
  expect(() => new PostgresTestDatabase("x".repeat(64))).toThrow(
    "Invalid test database name",
  );
});

test("a pending pool acquisition cannot escape cleanup", async () => {
  const database = await create();
  DB.initDB({
    db: { ...database.connection, database: database.name, max: 1 },
  });
  const runtime = DB.getInstance();
  database.trackRuntimeDB(runtime);
  const first = await runtime.getNewClient();
  const pending = runtime.getNewClient().then(
    () => {
      throw new Error("Acquired a client during cleanup");
    },
    (error: Error) => error,
  );
  await database.close();
  expect((await pending).message).toBe("Test database is closing");
  expect(await oid(database.name)).toBeUndefined();
  await first.release();
});
