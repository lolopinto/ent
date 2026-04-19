import { afterAll, beforeEach } from "bun:test";
import { DB } from "@snowtop/ent";
import { Client as PGClient } from "pg";
import { FakeComms } from "@snowtop/ent/testutils/fake_comms";
import { FakeLogger } from "@snowtop/ent/testutils/fake_log";
import { createDB } from "./globalSetup";
import { loadExampleRuntimeConfig } from "./example_runtime_config";

const globalSetupState = globalThis as typeof globalThis & {
  __simpleBunSetupPromise?: Promise<void>;
  __simpleBunTeardownPromise?: Promise<void>;
  __simpleBunAdminClient?: PGClient;
  __simpleBunDbName?: string;
};

if (!globalSetupState.__simpleBunSetupPromise) {
  globalSetupState.__simpleBunSetupPromise = (async () => {
    const { db, user, password, client } = await createDB();
    process.env.POSTGRES_TEST_DB = db;
    globalSetupState.__simpleBunAdminClient = client;
    globalSetupState.__simpleBunDbName = db;

    loadExampleRuntimeConfig({
      runtime: "bun",
      postgresDriver: "bun",
      db: {
        database: db,
        host: "localhost",
        user,
        password,
        port: 5432,
        sslmode: "disable",
      },
    });
  })();
}

await globalSetupState.__simpleBunSetupPromise;

beforeEach(() => {
  FakeLogger.clear();
  FakeComms.clear();
});

afterAll(async () => {
  if (!globalSetupState.__simpleBunTeardownPromise) {
    globalSetupState.__simpleBunTeardownPromise = (async () => {
      const db = globalSetupState.__simpleBunDbName;
      const client = globalSetupState.__simpleBunAdminClient;
      if (!db || !client) {
        return;
      }
      await DB.getInstance().endPool();
      try {
        await client.query(`DROP DATABASE ${db}`);
      } finally {
        await client.end();
      }
    })();
  }
  await globalSetupState.__simpleBunTeardownPromise;
});
