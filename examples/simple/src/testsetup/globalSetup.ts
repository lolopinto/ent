require("ts-node/register");
import { Client as PGClient } from "pg";
import * as path from "path";
import * as fs from "fs";

function randomDB(): string {
  let str = Math.random().toString(16).substring(2);

  // always ensure it starts with an alpha character
  return "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)] + str;
}

const sqlPath = "../schema/schema.sql";

// can be called by tests who want their own instance instead of global db
// responsibility of caller to call end() on client
export async function createDB() {
  const user = process.env.POSTGRES_USER || "";
  const password = process.env.POSTGRES_PASSWORD || "";

  const client = new PGClient({
    host: "localhost",
    user,
    password,
  });
  await client.connect();

  const db = randomDB();

  await client.query(`CREATE DATABASE ${db}`);

  const fullPath = path.join(__dirname, sqlPath);

  const sql = fs.readFileSync(fullPath).toString();

  const client2 = new PGClient({
    host: "localhost",
    user,
    password,
    database: db,
  });
  await client2.connect();
  await client2.query(sql);
  await client2.end();

  return { db, user, password, client };
}

async function setup() {
  const { db, client } = await createDB();

  process.env.POSTGRES_TEST_DB = db;
  // @ts-ignore
  global.__GLOBAL_CLIENT__ = client;
}

export default setup;
