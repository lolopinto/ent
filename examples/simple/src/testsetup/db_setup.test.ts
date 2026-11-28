import { afterAll, afterEach, beforeAll, expect, spyOn, test } from "bun:test";
import { randomUUID } from "crypto";
import * as fs from "fs";
import { Client } from "pg";
import { PostgresTestDatabase } from "@snowtop/ent/testutils/db/postgres_test_database";
import * as runtime from "../runtime_config";
import { createDB, ensureBunTestDB, teardownBunTestDB } from "./db_setup";

const admin = new Client({
  host: "localhost",
  database: "postgres",
  user: process.env.POSTGRES_USER || "",
  password: process.env.POSTGRES_PASSWORD || "",
});
const cleanups: (() => Promise<void>)[] = [];
const state = globalThis as typeof globalThis & {
  __simpleBunTestSetup?: unknown;
};
async function oid(name: string) {
  return (
    await admin.query("SELECT oid FROM pg_database WHERE datname = $1", [name])
  ).rows[0]?.oid;
}
beforeAll(() => admin.connect());
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) {
    await cleanup();
  }
});
afterAll(() => admin.end());

test("an explicit existing name preserves the database and its data", async () => {
  const setup = await createDB();
  cleanups.push(setup.cleanup);
  const connection = new Client({
    ...setup.database.connection,
    database: setup.db,
  });
  await connection.connect();
  try {
    await connection.query("CREATE TABLE cleanup_sentinel (value text)");
    await connection.query("INSERT INTO cleanup_sentinel VALUES ('keep')");
    const originalOID = await oid(setup.db);
    await expect(createDB(setup.db)).rejects.toMatchObject({ code: "42P04" });
    expect(await oid(setup.db)).toBe(originalOID);
    expect(
      (await connection.query("SELECT * FROM cleanup_sentinel")).rows,
    ).toEqual([{ value: "keep" }]);
  } finally {
    await connection.end();
  }
});

test("invalid schema SQL removes the created database before rejecting", async () => {
  const name = `ent_test_${randomUUID().replace(/-/g, "")}`;
  const read = spyOn(fs, "readFileSync").mockReturnValue(
    Buffer.from("CREATE TABLE invalid (id nonexistent_type)"),
  );
  try {
    await expect(createDB(name)).rejects.toThrow(
      'type "nonexistent_type" does not exist',
    );
    expect(await oid(name)).toBeUndefined();
  } finally {
    read.mockRestore();
  }
});

test("failed runtime setup removes its database and teardown remains safe", async () => {
  const previousState = state.__simpleBunTestSetup;
  const previousDatabase = process.env.POSTGRES_TEST_DB;
  state.__simpleBunTestSetup = {};
  let name: string | undefined;
  const create = PostgresTestDatabase.prototype.create;
  const capture = spyOn(
    PostgresTestDatabase.prototype,
    "create",
  ).mockImplementation(function (this: PostgresTestDatabase) {
    name = this.name;
    return create.call(this);
  });
  const failure = new Error("runtime initialization failed");
  const configure = spyOn(
    runtime,
    "loadExampleRuntimeConfig",
  ).mockImplementation(() => {
    throw failure;
  });
  try {
    await expect(ensureBunTestDB()).rejects.toBe(failure);
    expect(name).toBeDefined();
    expect(await oid(name!)).toBeUndefined();
    expect(process.env.POSTGRES_TEST_DB).toBe(previousDatabase);
    await teardownBunTestDB();
    await teardownBunTestDB();
  } finally {
    capture.mockRestore();
    configure.mockRestore();
    state.__simpleBunTestSetup = previousState;
  }
});
