import { DB } from "@snowtop/ent";
import { Client as PGClient } from "pg";
import { PostgresTestDatabase } from "@snowtop/ent/testutils/db/postgres_test_database";
import * as path from "path";
import * as fs from "fs";
import { loadExampleRuntimeConfig } from "../runtime_config";

type TestDBSetup = {
  db: string;
  user: string;
  password: string;
  cleanup: () => Promise<void>;
  database: PostgresTestDatabase;
};

type BunTestSetupState = {
  setupPromise?: Promise<TestDBSetup>;
  teardownPromise?: Promise<void>;
};

const sqlPath = "../schema/schema.sql";

function getBunTestSetupState(): BunTestSetupState {
  const globalState = globalThis as typeof globalThis & {
    __simpleBunTestSetup?: BunTestSetupState;
  };
  if (!globalState.__simpleBunTestSetup) {
    globalState.__simpleBunTestSetup = {};
  }
  return globalState.__simpleBunTestSetup;
}

export async function createDB(dbName?: string): Promise<TestDBSetup> {
  const database = new PostgresTestDatabase(dbName);
  const { name: db, user, password } = database;
  const cleanup = async () => {
    await database.close();
  };
  try {
    await database.create();
    const fullPath = path.join(__dirname, sqlPath);
    const sql = fs.readFileSync(fullPath).toString();
    const dbClient = new PGClient({ ...database.connection, database: db });
    database.trackClient(dbClient);
    await dbClient.connect();
    await dbClient.query(sql);
    await dbClient.end();
    return { db, user, password, cleanup, database };
  } catch (error) {
    return database.cleanupAfterFailure(error);
  }
}

export async function ensureBunTestDB() {
  const state = getBunTestSetupState();
  if (!state.setupPromise) {
    state.setupPromise = (async () => {
      const setup = await createDB();
      const previousDatabase = process.env.POSTGRES_TEST_DB;
      try {
        process.env.POSTGRES_TEST_DB = setup.db;

        loadExampleRuntimeConfig({
          runtime: "bun",
          postgresDriver: "bun",
          db: {
            database: setup.db,
            host: "localhost",
            user: setup.user,
            password: setup.password,
            port: 5432,
            sslmode: "disable",
          },
        });
        setup.database.trackRuntimeDB(DB.instance);
      } catch (error) {
        if (previousDatabase === undefined) {
          delete process.env.POSTGRES_TEST_DB;
        } else {
          process.env.POSTGRES_TEST_DB = previousDatabase;
        }
        return setup.database.cleanupAfterFailure(error);
      }

      return setup;
    })();
  }
  return state.setupPromise;
}

export async function teardownBunTestDB() {
  const state = getBunTestSetupState();
  if (!state.teardownPromise) {
    state.teardownPromise = (async () => {
      if (!state.setupPromise) {
        return;
      }
      let setup: TestDBSetup;
      try {
        setup = await state.setupPromise;
      } catch {
        // Failed setup already cleaned up and preserved the original error.
        return;
      }
      await setup.cleanup();
    })();
  }
  await state.teardownPromise;
}
