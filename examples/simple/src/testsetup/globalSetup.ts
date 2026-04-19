if (!process.versions.bun) {
  require("ts-node/register");
}
import { Client as PGClient } from "pg";
import * as path from "path";
import * as fs from "fs";

function randomDB(): string {
  let str = Math.random().toString(16).substring(2);

  // always ensure it starts with an alpha character
  return "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)] + str;
}

const sqlPath = "../schema/schema.sql";
const schemaPyPath = "../schema/schema.py";

type AssocEdgeConfig = {
  edge_name: string;
  edge_type: string;
  edge_table: string;
  symmetric_edge: boolean;
  inverse_edge_type: string | null;
};

function loadAssocEdgeConfig(): AssocEdgeConfig[] {
  const fullPath = path.join(__dirname, schemaPyPath);
  const schemaPy = fs.readFileSync(fullPath, { encoding: "utf8" });
  const regex =
    /'([^']+)': \{"edge_name":"([^"]+)", "edge_type":"([^"]+)", "edge_table":"([^"]+)", "symmetric_edge":(True|False), "inverse_edge_type":(?:"([^"]+)"|None)\},?/g;

  const edges: AssocEdgeConfig[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(schemaPy))) {
    edges.push({
      edge_name: match[2],
      edge_type: match[3],
      edge_table: match[4],
      symmetric_edge: match[5] === "True",
      inverse_edge_type: match[6] || null,
    });
  }

  if (!edges.length) {
    throw new Error("could not parse assoc_edge_config entries from schema.py");
  }

  return edges;
}

async function syncAssocEdgeConfig(client: PGClient) {
  const edges = loadAssocEdgeConfig();
  await client.query("DELETE FROM assoc_edge_config");

  for (const edge of edges) {
    await client.query(
      `INSERT INTO assoc_edge_config(edge_name, edge_type, edge_table, symmetric_edge, inverse_edge_type, created_at, updated_at)
       VALUES($1, $2, $3, $4, $5, now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC')`,
      [
        edge.edge_name,
        edge.edge_type,
        edge.edge_table,
        edge.symmetric_edge,
        null,
      ],
    );
  }

  for (const edge of edges) {
    if (!edge.inverse_edge_type) {
      continue;
    }
    await client.query(
      "UPDATE assoc_edge_config SET inverse_edge_type = $1 WHERE edge_type = $2",
      [edge.inverse_edge_type, edge.edge_type],
    );
  }
}

// can be called by tests who want their own instance instead of global db
// responsibility of caller to call end() on client
export async function createDB(dbName?: string) {
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

  const client2 = new PGClient({
    host: "localhost",
    user,
    password,
    database: db,
  });
  await client2.connect();
  await client2.query(sql);
  await syncAssocEdgeConfig(client2);
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
