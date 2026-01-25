import * as fs from "fs";
import { load } from "js-yaml";
import { DateTime } from "luxon";
import pg, { Pool, PoolClient, PoolConfig } from "pg";
import { log } from "./logger";
import type { DevSchemaConfig } from "./config";
import { resolveDevSchema, ResolvedDevSchema } from "./dev_schema";

export interface Database extends PoolConfig {
  database?: string;
  user?: string;
  password?: string;
  host?: string;
  port?: number;
  sslmode?: string;
}

// probably should just be string?
// depends on NODE_ENV values.
export type env = "production" | "test" | "development";
export declare type DBDict = Partial<Record<env, Database>>;

function isDbDict(v: Database | DBDict): v is DBDict {
  return (
    v["production"] !== undefined ||
    v["development"] !== undefined ||
    v["test"] !== undefined
  );
}

interface customPoolConfig extends PoolConfig {
  sslmode?: string;
}

export enum Dialect {
  Postgres = "postgres",
  SQLite = "sqlite",
}

function parseConnectionString(
  str: string,
  args?: clientConfigArgs,
): DatabaseInfo {
  if (str.startsWith("sqlite:///")) {
    let filePath = str.substr(10);

    return {
      dialect: Dialect.SQLite,
      config: {
        connectionString: str,
        ...args?.cfg,
      },
      filePath,
    };
  }

  return {
    dialect: Dialect.Postgres,
    config: {
      ...args?.cfg,
      connectionString: str,
    },
  };
}

interface DatabaseInfo {
  dialect: Dialect;
  config: PoolConfig;
  /// filePath for sqlite
  filePath?: string;
  devSchema?: DevSchemaConfig;
}

interface clientConfigArgs {
  connectionString?: string;
  dbFile?: string;
  db?: Database | DBDict;
  cfg?: PoolConfig;
  devSchema?: DevSchemaConfig;
}
// order
// env variable
// connString in config
// db in Config file (helpful for test vs development)
// database file in yml file
// database/config.yml
function getClientConfig(args?: clientConfigArgs): DatabaseInfo | null {
  // if there's a db connection string, use that first
  const str = process.env.DB_CONNECTION_STRING;
  if (str) {
    const info = parseConnectionString(str, args);
    info.devSchema = args?.devSchema;
    return info;
  }

  let file = "config/database.yml";
  if (args) {
    if (args.connectionString) {
      const info = parseConnectionString(args.connectionString, args);
      info.devSchema = args?.devSchema;
      return info;
    }

    if (args.db) {
      let db: Database;
      if (isDbDict(args.db)) {
        if (!process.env.NODE_ENV) {
          throw new Error(`process.env.NODE_ENV is undefined`);
        }
        db = args.db[process.env.NODE_ENV];
      } else {
        db = args.db;
      }
      return {
        dialect: Dialect.Postgres,
        config: db,
        devSchema: args?.devSchema,
      };
    }

    if (args.dbFile) {
      file = args.dbFile;
    }
  }

  if (!fs.existsSync(file)) {
    return null;
  }

  try {
    // TODO support multiple environments in database/config.yaml file.
    // if needed for now, general yaml file should be used
    let data = fs.readFileSync(file, { encoding: "utf8" });
    let yaml = load(data);
    if (yaml && typeof yaml === "object") {
      let cfg: customPoolConfig = yaml;
      return {
        dialect: Dialect.Postgres,
        config: {
          database: cfg.database,
          user: cfg.user,
          password: cfg.password,
          host: cfg.host,
          port: cfg.port,
          ssl: cfg.sslmode == "enable",
          // max, min, etc
          ...cfg,
        },
        devSchema: args?.devSchema,
      };
    }
    throw new Error(`invalid yaml configuration in file`);
  } catch (e) {
    console.error("error reading file" + e.message);
    return null;
  }
}

export default class DB {
  static instance: DB;
  static dialect: Dialect;

  private pool: Pool;
  private q: Connection;
  private constructor(public db: DatabaseInfo) {
    const resolvedDevSchema = resolveDevSchema(db.devSchema);
    if (resolvedDevSchema.enabled && db.dialect === Dialect.SQLite) {
      throw new Error(
        "dev branch schemas are only supported for postgres",
      );
    }

    if (db.dialect === Dialect.Postgres) {
      if (resolvedDevSchema.enabled && resolvedDevSchema.schemaName) {
        const searchPath = resolvedDevSchema.includePublic
          ? `${resolvedDevSchema.schemaName},public`
          : resolvedDevSchema.schemaName;
        const option = `-c search_path=${searchPath}`;
        db.config = {
          ...db.config,
          options: db.config.options
            ? `${db.config.options} ${option}`
            : option,
        };
      }

      this.pool = new Pool(db.config);
      const devSchemaReady =
        resolvedDevSchema.enabled && resolvedDevSchema.schemaName
          ? setupDevSchema(this.pool, resolvedDevSchema, db.devSchema)
          : undefined;
      if (devSchemaReady) {
        devSchemaReady.catch((err) => {
          log("error", err);
        });
      }
      this.q = new Postgres(this.pool, devSchemaReady);

      this.pool.on("error", (err, client) => {
        log("error", err);
      });
    } else {
      let sqlite = require("better-sqlite3");
      const dbb = sqlite(db.filePath || "");
      dbb.pragma("journal_mode = WAL");
      this.q = new Sqlite(dbb);
    }
  }

  getConnection(): Connection {
    return this.q;
  }

  // TODO rename all these...
  getPool(): Queryer {
    return this.q.self();
  }

  // TODO rename
  // expect to release client as needed
  async getNewClient(): Promise<Client> {
    return this.q.newClient();
  }

  getSQLiteClient(): Sqlite {
    if (this.db.dialect == Dialect.Postgres) {
      throw new Error(`can't call getSQLiteClient when dialect is postgres`);
    }
    return this.q as Sqlite;
  }

  // this should be called when the server is shutting down or end of tests.
  async endPool(): Promise<void> {
    return this.q.close();
  }

  emitsExplicitTransactionStatements() {
    const instance = DB.getInstance();
    return instance.q.runInTransaction === undefined;
  }

  // throws if invalid
  static getInstance(): DB {
    if (DB.instance) {
      return DB.instance;
    }

    const clientConfig = getClientConfig();
    if (!clientConfig) {
      throw new Error("could not load client config");
    }
    DB.instance = new DB(clientConfig);
    DB.dialect = DB.instance.db.dialect;
    return DB.instance;
  }

  static getDialect(): Dialect {
    if (DB.dialect) {
      return DB.dialect;
    }
    // default to postgres
    return Dialect.Postgres;
  }

  static initDB(args?: clientConfigArgs) {
    const config = getClientConfig(args);
    if (config) {
      DB.instance = new DB(config);
      DB.dialect = DB.instance.db.dialect;
    }
  }
}

export const defaultTimestampParser: (value: string) => string =
  pg.types.getTypeParser(pg.types.builtins.TIMESTAMP);

// this is stored in the db without timezone but we want to make sure
// it's parsed as UTC time as opposed to the local time
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, function (val: string) {
  return DateTime.fromSQL(val + "Z").toJSDate();
});
pg.types.setTypeParser(pg.types.builtins.DATE, function (val: string) {
  return val;
});

// pg-types only exposes scalar OIDs, so we have to hard-code the array
// OIDs we care about (DATE[] and TEXT[]). If these ever change upstream,
// update the constants below.
const TEXT_ARRAY_OID = 1009;
const DATE_ARRAY_OID = 1182;
// TEXT[] already parses to string[], so reuse that parser for DATE[]
const parseTextArray = pg.types.getTypeParser(TEXT_ARRAY_OID as any);
pg.types.setTypeParser(DATE_ARRAY_OID as any, function (val: string | null) {
  if (val === null) {
    return null;
  }
  return parseTextArray(val);
});

export interface Queryer {
  query(query: string, values?: any[]): Promise<QueryResult<QueryResultRow>>;
  queryAll(query: string, values?: any[]): Promise<QueryResult<QueryResultRow>>;
  // exec a query with no result
  // e.g. insert in sqlite etc
  // exec has no async/await in sqlite...
  exec(query: string, values?: any[]): Promise<ExecResult>;
}

// if this exists, we don't want to use async/await
// e.g. SQLite
export interface SyncQueryer extends Queryer {
  execSync(query: string, values?: any[]): ExecResult;
  queryAllSync(query: string, values?: any[]): QueryResult<QueryResultRow>;
  querySync(query: string, values?: any[]): QueryResult<QueryResultRow>;
}

export interface Connection extends Queryer {
  self(): Queryer;
  newClient(): Promise<Client>;
  close(): Promise<void>;
  runInTransaction?(cb: () => void | Promise<void>);
}

export interface QueryResultRow {
  [column: string]: any;
}

export interface QueryResult<R extends QueryResultRow = any> {
  rows: R[];
  rowCount: number;
  // postgres fields
  //  command: string;
  //  oid: number;
  //  fields: FieldDef[];
}

interface ExecResult {
  rows: QueryResultRow[];
  rowCount: number;
}

export interface Client extends Queryer {
  release(err?: Error | boolean): void;
}

export interface SyncClient extends Client, SyncQueryer {
  runInTransaction(cb: () => void): void;
}

// interfaces we provide to have strong typing here so as to not import
// better-sqlite3. ideally, import type would be used but that seems
// to have downstream issues when this library is used
interface SqliteRunResult {
  changes: number;
  lastInsertRowid: number;
}

interface SqliteDatabase {
  memory: boolean;
  exec(query: string): SqliteStatement;
  prepare(query: string): SqliteStatement;
  close(): void;
  transaction(fn: (...params: any[]) => any): SqliteTransaction;
}

interface SqliteStatement {
  get(...params: any): SqliteRunResult;
  all(...params: any): SqliteRunResult[];
  run(...params: any): SqliteRunResult;
}

interface SqliteTransaction {
  (...params: any): void;
}

export class Sqlite implements Connection, SyncClient {
  constructor(public db: SqliteDatabase) {}

  self() {
    return this;
  }

  // returns self
  async newClient() {
    return this;
  }

  async query(
    query: string,
    values?: any[],
  ): Promise<QueryResult<QueryResultRow>> {
    return this.querySync(query, values);
  }

  private convertValues(values: any[]) {
    for (const key in values) {
      let value = values[key];
      if (value === true) {
        values[key] = 1;
      } else if (value === false) {
        values[key] = 0;
      } else if (value instanceof Date) {
        values[key] = value.toISOString();
      }
    }
    return values;
  }

  querySync(query: string, values?: any[]): QueryResult<QueryResultRow> {
    let r: SqliteRunResult;

    if (values) {
      r = this.db.prepare(query).get(this.convertValues(values));
    } else {
      // TODO querySync() with no values seems to do the wrong thing...
      // e.g. querySync('select count(*) as count from table') returns nonsense
      r = this.db.prepare(query).run();
    }
    return {
      rowCount: r === undefined ? 0 : 1,
      rows: r ? [r] : [],
    };
  }

  async queryAll(
    query: string,
    values?: any[],
  ): Promise<QueryResult<QueryResultRow>> {
    return this.queryAllSync(query, values);
  }

  queryAllSync(query: string, values?: any[]): QueryResult<QueryResultRow> {
    let r: any[];
    if (values) {
      r = this.db.prepare(query).all(this.convertValues(values));
    } else {
      r = this.db.prepare(query).all();
    }
    return {
      rowCount: r.length,
      rows: r,
    };
  }

  async exec(query: string, values?: any[]): Promise<ExecResult> {
    throw new Error(
      `exec shouldn't be called. execSync() should be called instead`,
    );
  }

  execSync(query: string, values?: any[]): ExecResult {
    let r: SqliteRunResult;
    if (values) {
      r = this.db.prepare(query).run(this.convertValues(values));
    } else {
      r = this.db.prepare(query).run();
    }
    return {
      rowCount: r!.changes,
      rows: [],
    };
  }

  async close() {
    this.db.close();
  }

  async release(err?: Error | boolean) {}

  runInTransaction(cb: () => void | Promise<void>) {
    const tr = this.db.transaction(() => {
      cb();
    });
    tr();
  }
}

export class Postgres implements Connection {
  constructor(private pool: Pool, private ready?: Promise<void>) {}

  private async ensureReady() {
    if (this.ready) {
      await this.ready;
    }
  }

  self() {
    return this;
  }

  // returns new Pool client
  async newClient() {
    await this.ensureReady();
    const client = await this.pool.connect();
    if (!client) {
      throw new Error(`couldn't get new client`);
    }
    return new PostgresClient(client, this.ready);
  }

  async query(
    query: string,
    values?: any[],
  ): Promise<QueryResult<QueryResultRow>> {
    await this.ensureReady();
    const r = await this.pool.query(query, values);
    return r as QueryResult<QueryResultRow>;
  }

  async queryAll(
    query: string,
    values?: any[],
  ): Promise<QueryResult<QueryResultRow>> {
    await this.ensureReady();
    const r = await this.pool.query(query, values);
    return r as QueryResult<QueryResultRow>;
  }

  async exec(query: string, values?: any[]): Promise<ExecResult> {
    await this.ensureReady();
    const r = await this.pool.query(query, values);
    return {
      rowCount: r?.rowCount || 0,
      rows: r?.rows || [],
    };
  }

  async close() {
    return this.pool.end();
  }
}

export class PostgresClient implements Client {
  constructor(private client: PoolClient, private ready?: Promise<void>) {}

  private async ensureReady() {
    if (this.ready) {
      await this.ready;
    }
  }

  async query(
    query: string,
    values?: any[],
  ): Promise<QueryResult<QueryResultRow>> {
    await this.ensureReady();
    const r = await this.client.query(query, values);
    return r as QueryResult<QueryResultRow>;
  }

  async queryAll(
    query: string,
    values?: any[],
  ): Promise<QueryResult<QueryResultRow>> {
    await this.ensureReady();
    const r = await this.client.query(query, values);
    return r as QueryResult<QueryResultRow>;
  }

  async exec(query: string, values?: any[]): Promise<ExecResult> {
    await this.ensureReady();
    const r = await this.client.query(query, values);
    return {
      rowCount: r?.rowCount || 0,
      rows: r?.rows || [],
    };
  }

  async release(err?: Error | boolean) {
    return this.client.release(err);
  }
}

const REGISTRY_TABLE = "public.ent_dev_schema_registry";

async function setupDevSchema(
  pool: Pool,
  resolved: ResolvedDevSchema,
  cfg?: DevSchemaConfig,
) {
  if (!resolved.schemaName) {
    return;
  }
  await ensureSchema(pool, resolved.schemaName);
  await touchRegistry(pool, resolved.schemaName, resolved.branchName);

  const pruneEnabled =
    parseEnvBool("ENT_DEV_SCHEMA_PRUNE_ENABLED") ??
    cfg?.prune?.enabled ??
    false;
  if (!pruneEnabled) {
    return;
  }
  const pruneDays =
    parseEnvInt("ENT_DEV_SCHEMA_PRUNE_DAYS") ?? cfg?.prune?.days ?? 30;
  const prefix =
    resolved.prefix || cfg?.prefix || process.env.ENT_DEV_SCHEMA_PREFIX;
  await pruneSchemas(pool, prefix, pruneDays);
}

async function ensureSchema(pool: Pool, schemaName: string) {
  const ident = quoteIdent(schemaName);
  await pool.query(`CREATE SCHEMA IF NOT EXISTS ${ident}`);
}

async function touchRegistry(
  pool: Pool,
  schemaName: string,
  branchName?: string,
) {
  await ensureRegistry(pool);
  await pool.query(
    `
INSERT INTO ${REGISTRY_TABLE} (schema_name, branch_name, created_at, last_used_at)
VALUES ($1, $2, now(), now())
ON CONFLICT (schema_name)
DO UPDATE SET last_used_at = now(), branch_name = EXCLUDED.branch_name
`,
    [schemaName, branchName || null],
  );
}

async function ensureRegistry(pool: Pool) {
  await pool.query(`
CREATE TABLE IF NOT EXISTS ${REGISTRY_TABLE} (
  schema_name TEXT PRIMARY KEY,
  branch_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`);
}

async function pruneSchemas(
  pool: Pool,
  prefix: string | undefined,
  days: number,
) {
  const schemaPrefix = prefix || "ent_dev";
  const res = await pool.query(
    `
SELECT schema_name
FROM ${REGISTRY_TABLE}
WHERE schema_name LIKE $1
  AND last_used_at < (now() - $2::interval)
`,
    [`${schemaPrefix}%`, `${days} days`],
  );

  for (const row of res.rows) {
    const name = row.schema_name as string;
    if (!name.startsWith(schemaPrefix)) {
      continue;
    }
    const exists = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = $1) AS ok",
      [name],
    );
    if (!exists.rows?.[0]?.ok) {
      await pool.query(`DELETE FROM ${REGISTRY_TABLE} WHERE schema_name = $1`, [
        name,
      ]);
      continue;
    }
    await pool.query(`DROP SCHEMA ${quoteIdent(name)} CASCADE`);
    await pool.query(`DELETE FROM ${REGISTRY_TABLE} WHERE schema_name = $1`, [
      name,
    ]);
  }
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, `""`)}"`;
}

function parseEnvBool(key: string): boolean | undefined {
  const raw = process.env[key];
  if (!raw) {
    return undefined;
  }
  const val = raw.trim().toLowerCase();
  if (["1", "true", "t", "yes", "y"].includes(val)) {
    return true;
  }
  if (["0", "false", "f", "no", "n"].includes(val)) {
    return false;
  }
  return undefined;
}

function parseEnvInt(key: string): number | undefined {
  const raw = process.env[key];
  if (!raw) {
    return undefined;
  }
  const val = parseInt(raw, 10);
  if (Number.isNaN(val)) {
    return undefined;
  }
  return val;
}
