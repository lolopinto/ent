import { DB } from "@snowtop/ent";
import { Client as PGClient } from "pg";
import * as path from "path";
import * as fs from "fs";
import { loadExampleRuntimeConfig } from "./example_runtime_config";

type TestDBSetup = {
  db: string;
  user: string;
  password: string;
  client: PGClient;
};

type BunTestSetupState = {
  setupPromise?: Promise<TestDBSetup>;
  teardownPromise?: Promise<void>;
};

const sqlPath = "../schema/schema.sql";

function randomDB(): string {
  const str = Math.random().toString(16).substring(2);

  // always ensure it starts with an alpha character
  return "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)] + str;
}

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
  const user = process.env.POSTGRES_USER || "";
  const password = process.env.POSTGRES_PASSWORD || "";

  const client = new PGClient({
    host: "localhost",
    user,
    password,
  });
  await client.connect();

  const db = dbName || randomDB();
  if (dbName) {
    await client.query(`DROP DATABASE IF EXISTS ${db}`);
  }
  await client.query(`CREATE DATABASE ${db}`);

  const fullPath = path.join(__dirname, sqlPath);
  const sql = fs.readFileSync(fullPath).toString();

  const dbClient = new PGClient({
    host: "localhost",
    user,
    password,
    database: db,
  });
  await dbClient.connect();
  await dbClient.query(sql);
  await dbClient.end();

  return { db, user, password, client };
}

export async function ensureBunTestDB() {
  const state = getBunTestSetupState();
  if (!state.setupPromise) {
    state.setupPromise = (async () => {
      const setup = await createDB();
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
      const { db, client } = await state.setupPromise;
      await DB.getInstance().endPool();
      try {
        await client.query(`DROP DATABASE ${db}`);
      } finally {
        await client.end();
      }
    })();
  }
  await state.teardownPromise;
}
