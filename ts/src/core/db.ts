import * as fs from "fs";
import { load } from "js-yaml";
import { DateTime } from "luxon";
import pg, { Pool, PoolClient, PoolConfig } from "pg";
import { log } from "./logger";
import type {
  PostgresDriver,
  RuntimeDBExtension,
  RuntimeDevSchemaConfig,
  RuntimeMode,
} from "./config";
import { isDevSchemaEnabled, resolveDevSchema } from "./dev_schema";
import {
  buildExtensionSearchPath,
  initializeExtensions,
  resolveExtensions,
} from "./extensions";

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
const knownEnvs: readonly env[] = ["production", "development", "test"];

function isEnv(value: string): value is env {
  return knownEnvs.includes(value as env);
}

function isDbDict(v: Database | DBDict): v is DBDict {
  return knownEnvs.some((key) => key in v);
}

interface customPoolConfig extends PoolConfig {
  sslmode?: string;
}

interface BunSQLConfig {
  url?: string;
  hostname?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  max?: number;
  tls?: boolean | Record<string, any>;
  onconnect?: (client: BunSQLClientLike) => void | Promise<void>;
  onclose?: (client: BunSQLClientLike, err?: Error) => void;
}

interface BunSQLResult extends Array<QueryResultRow> {
  count?: number;
  affectedRows?: number;
}

interface BunSQLClientLike {
  unsafe(query: string, values?: any[]): Promise<BunSQLResult>;
}

interface BunSQLReservedClient extends BunSQLClientLike {
  release(): void | Promise<void>;
}

interface BunSQLPool extends BunSQLClientLike {
  reserve(): Promise<BunSQLReservedClient>;
  close(options?: { timeout?: number }): Promise<void>;
}

type BunSQLConstructor = new (options?: string | BunSQLConfig) => BunSQLPool;

export enum Dialect {
  Postgres = "postgres",
  SQLite = "sqlite",
}

function normalizeRuntimeMode(runtime?: RuntimeMode | string): RuntimeMode {
  switch (runtime) {
    case undefined:
    case "":
    case "node":
      return "node";
    case "bun":
      return "bun";
    default:
      throw new Error(`invalid runtime "${runtime}". valid values: node, bun`);
  }
}

function normalizePostgresDriver(
  driver?: PostgresDriver | string,
): PostgresDriver {
  switch (driver) {
    case undefined:
    case "":
    case "pg":
      return "pg";
    case "bun":
      return "bun";
    default:
      throw new Error(
        `invalid postgresDriver "${driver}". valid values: pg, bun`,
      );
  }
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
  runtime?: RuntimeMode;
  postgresDriver?: PostgresDriver;
  /// filePath for sqlite
  filePath?: string;
  devSchema?: RuntimeDevSchemaConfig;
  extensions?: RuntimeDBExtension[];
}

interface clientConfigArgs {
  runtime?: RuntimeMode;
  postgresDriver?: PostgresDriver;
  connectionString?: string;
  dbFile?: string;
  db?: Database | DBDict;
  cfg?: PoolConfig;
  devSchema?: RuntimeDevSchemaConfig;
  extensions?: RuntimeDBExtension[];
}
// order
// env variable
// connString in config
// db in Config file (helpful for test vs development)
// database file in yml file
// database/config.yml
function getClientConfig(args?: clientConfigArgs): DatabaseInfo | null {
  const extensions = resolveExtensions(args?.extensions);
  const runtime = normalizeRuntimeMode(
    args?.runtime ?? (process.env.ENT_RUNTIME as RuntimeMode | undefined),
  );
  const postgresDriver = normalizePostgresDriver(
    args?.postgresDriver ??
      (process.env.ENT_POSTGRES_DRIVER as PostgresDriver | undefined),
  );

  // if there's a db connection string, use that first
  const str = process.env.DB_CONNECTION_STRING;
  if (str) {
    const info = parseConnectionString(str, args);
    info.runtime = runtime;
    info.postgresDriver = postgresDriver;
    info.devSchema = args?.devSchema;
    info.extensions = extensions;
    return info;
  }

  let file = "config/database.yml";
  if (args) {
    if (args.connectionString) {
      const info = parseConnectionString(args.connectionString, args);
      info.runtime = runtime;
      info.postgresDriver = postgresDriver;
      info.devSchema = args?.devSchema;
      info.extensions = extensions;
      return info;
    }

    if (args.db) {
      let db: Database;
      if (isDbDict(args.db)) {
        const nodeEnv = process.env.NODE_ENV;
        if (!nodeEnv) {
          throw new Error(`process.env.NODE_ENV is undefined`);
        }
        if (!isEnv(nodeEnv)) {
          throw new Error(`unsupported process.env.NODE_ENV value: ${nodeEnv}`);
        }
        const envDB = args.db[nodeEnv];
        if (!envDB) {
          throw new Error(`database config missing for environment ${nodeEnv}`);
        }
        db = envDB;
      } else {
        db = args.db;
      }
      return {
        dialect: Dialect.Postgres,
        config: db,
        runtime,
        postgresDriver,
        devSchema: args?.devSchema,
        extensions,
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
        runtime,
        postgresDriver,
        devSchema: args?.devSchema,
        extensions,
      };
    }
    throw new Error(`invalid yaml configuration in file`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("error reading file" + message);
    return null;
  }
}

function getBunSQLConstructor(): BunSQLConstructor {
  const BunRuntime = (
    globalThis as typeof globalThis & {
      Bun?: { SQL?: BunSQLConstructor };
    }
  ).Bun;
  const SQL = BunRuntime?.SQL;
  if (!SQL) {
    throw new Error(`postgresDriver "bun" requires running under Bun`);
  }
  return SQL;
}

function createBunSQLConfig(
  config: PoolConfig,
  searchPath?: string,
): BunSQLConfig {
  const cfg = config as Database;
  const bunConfig: BunSQLConfig = {};

  if (config.connectionString) {
    bunConfig.url = config.connectionString;
  } else {
    if (cfg.host) {
      bunConfig.hostname = cfg.host;
    }
    if (cfg.port) {
      bunConfig.port = cfg.port;
    }
    if (cfg.database) {
      bunConfig.database = cfg.database;
    }
    if (cfg.user) {
      bunConfig.username = cfg.user;
    }
    if (cfg.password) {
      bunConfig.password = cfg.password;
    }
  }

  if (typeof config.max === "number") {
    bunConfig.max = config.max;
  }

  if (cfg.sslmode) {
    bunConfig.tls = cfg.sslmode !== "disable";
  } else if (config.ssl !== undefined) {
    bunConfig.tls = config.ssl as boolean | Record<string, any>;
  }

  if (searchPath) {
    bunConfig.onconnect = async (client) => {
      await client.unsafe("SELECT set_config('search_path', $1, false)", [
        searchPath,
      ]);
    };
  }

  return bunConfig;
}

function normalizeBunResult(result: BunSQLResult): QueryResult<QueryResultRow> {
  const rows = Array.isArray(result) ? [...result] : [];
  const rowCount =
    typeof result?.count === "number"
      ? result.count
      : typeof result?.affectedRows === "number"
        ? result.affectedRows
        : rows.length;
  return {
    rows,
    rowCount,
  };
}

function isPlainObject(value: any): value is Record<string, any> {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function serializePostgresArray(values: any[]): string {
  return `{${values.map((entry) => serializePostgresArrayElement(entry)).join(",")}}`;
}

function serializePostgresArrayElement(value: any): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (Array.isArray(value)) {
    return serializePostgresArray(value);
  }

  const str =
    value instanceof Date
      ? value.toISOString()
      : isPlainObject(value)
        ? JSON.stringify(value)
        : String(value);
  return `"${str.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function serializeBunValue(value: any): any {
  if (Array.isArray(value)) {
    return serializePostgresArray(value);
  }
  if (isPlainObject(value)) {
    return JSON.stringify(value);
  }

  return value;
}

function serializeBunValues(values?: any[]): any[] | undefined {
  return values?.map((value) => serializeBunValue(value));
}

function createBunQueryable(sql: BunSQLClientLike): PostgresQueryable {
  return {
    async query<R extends QueryResultRow = any>(
      query: string,
      values?: any[],
    ): Promise<QueryResult<R>> {
      return normalizeBunResult(
        await sql.unsafe(query, serializeBunValues(values)),
      ) as QueryResult<R>;
    },
  };
}

export default class DB {
  static instance: DB;
  static dialect: Dialect;

  private q: Connection;
  private constructor(public db: DatabaseInfo) {
    const devSchemaEnabled = isDevSchemaEnabled(db.devSchema);
    if (devSchemaEnabled && db.dialect === Dialect.SQLite) {
      throw new Error("dev branch schemas are only supported for postgres");
    }
    const resolvedDevSchema = devSchemaEnabled
      ? resolveDevSchema(db.devSchema)
      : { enabled: false };
    const extensions = db.extensions || [];

    if (db.dialect === Dialect.Postgres) {
      const searchPath = buildExtensionSearchPath(
        resolvedDevSchema,
        extensions,
      );
      const postgresDriver = normalizePostgresDriver(db.postgresDriver);
      db.runtime = normalizeRuntimeMode(db.runtime);
      db.postgresDriver = postgresDriver;

      if (postgresDriver === "pg" && searchPath) {
        const option = `-c search_path=${searchPath}`;
        db.config = {
          ...db.config,
          options: db.config.options
            ? `${db.config.options} ${option}`
            : option,
        };
      }
      const schemaName = resolvedDevSchema.schemaName;

      if (postgresDriver === "bun") {
        const SQL = getBunSQLConstructor();
        const sql = new SQL(createBunSQLConfig(db.config, searchPath));
        const queryable = createBunQueryable(sql);
        const readyTasks: Promise<void>[] = [];
        if (resolvedDevSchema.enabled && schemaName) {
          readyTasks.push(
            validateDevSchema(queryable, schemaName).then(() =>
              touchDevSchemaRegistry(
                queryable,
                schemaName,
                resolvedDevSchema.branchName,
              ).catch(() => {}),
            ),
          );
        }
        readyTasks.push(
          initializeExtensions(queryable, extensions, postgresDriver),
        );
        const ready =
          readyTasks.length > 0
            ? Promise.all(readyTasks).then(() => undefined)
            : undefined;
        if (ready) {
          ready.catch(() => {});
        }
        this.q = new BunPostgres(sql, ready);
      } else {
        const pool = new Pool(db.config);
        const readyTasks: Promise<void>[] = [];
        if (resolvedDevSchema.enabled && schemaName) {
          readyTasks.push(
            validateDevSchema(pool, schemaName).then(() =>
              touchDevSchemaRegistry(
                pool,
                schemaName,
                resolvedDevSchema.branchName,
              ).catch(() => {}),
            ),
          );
        }
        readyTasks.push(initializeExtensions(pool, extensions, postgresDriver));
        const ready =
          readyTasks.length > 0
            ? Promise.all(readyTasks).then(() => undefined)
            : undefined;
        if (ready) {
          ready.catch(() => {});
        }
        this.q = new Postgres(pool, ready);

        pool.on("error", (err) => {
          log("error", err);
        });
      }
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
      const existing = DB.instance;
      if (existing) {
        void existing.endPool().catch(() => {});
      }
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
  runInTransaction?(cb: () => void | Promise<void>): void | Promise<void>;
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
  private closePromise?: Promise<void>;

  constructor(
    private pool: Pool,
    private ready?: Promise<void>,
  ) {}

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
    if (!this.closePromise) {
      this.closePromise = this.pool.end();
    }
    return this.closePromise;
  }
}

export class PostgresClient implements Client {
  constructor(
    private client: PoolClient,
    private ready?: Promise<void>,
  ) {}

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

export class BunPostgres implements Connection {
  private closePromise?: Promise<void>;

  constructor(
    private sql: BunSQLPool,
    private ready?: Promise<void>,
  ) {}

  private async ensureReady() {
    if (this.ready) {
      await this.ready;
    }
  }

  self() {
    return this;
  }

  async newClient() {
    await this.ensureReady();
    const client = await this.sql.reserve();
    return new BunPostgresClient(client, this.ready);
  }

  async query(
    query: string,
    values?: any[],
  ): Promise<QueryResult<QueryResultRow>> {
    await this.ensureReady();
    return normalizeBunResult(
      await this.sql.unsafe(query, serializeBunValues(values)),
    );
  }

  async queryAll(
    query: string,
    values?: any[],
  ): Promise<QueryResult<QueryResultRow>> {
    await this.ensureReady();
    return normalizeBunResult(
      await this.sql.unsafe(query, serializeBunValues(values)),
    );
  }

  async exec(query: string, values?: any[]): Promise<ExecResult> {
    await this.ensureReady();
    return normalizeBunResult(
      await this.sql.unsafe(query, serializeBunValues(values)),
    );
  }

  async close() {
    if (!this.closePromise) {
      this.closePromise = this.sql.close();
    }
    return this.closePromise;
  }
}

export class BunPostgresClient implements Client {
  constructor(
    private client: BunSQLReservedClient,
    private ready?: Promise<void>,
  ) {}

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
    return normalizeBunResult(
      await this.client.unsafe(query, serializeBunValues(values)),
    );
  }

  async queryAll(
    query: string,
    values?: any[],
  ): Promise<QueryResult<QueryResultRow>> {
    await this.ensureReady();
    return normalizeBunResult(
      await this.client.unsafe(query, serializeBunValues(values)),
    );
  }

  async exec(query: string, values?: any[]): Promise<ExecResult> {
    await this.ensureReady();
    return normalizeBunResult(
      await this.client.unsafe(query, serializeBunValues(values)),
    );
  }

  async release(err?: Error | boolean) {
    await this.client.release();
  }
}

interface PostgresQueryable {
  query<R extends QueryResultRow = any>(
    query: string,
    values?: any[],
  ): Promise<QueryResult<R>>;
}

async function validateDevSchema(pool: PostgresQueryable, schemaName: string) {
  const res = await pool.query(
    "SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = $1) AS ok",
    [schemaName],
  );
  if (!res.rows?.[0]?.ok) {
    throw new Error(
      `dev branch schema \"${schemaName}\" does not exist. Run auto_schema or migrations to create it.`,
    );
  }
}

async function touchDevSchemaRegistry(
  pool: PostgresQueryable,
  schemaName: string,
  branchName?: string,
) {
  const branch = branchName ?? null;
  try {
    // Avoid DDL at runtime; registry table should be created by auto_schema/prune.
    await pool.query(
      `
      INSERT INTO public.ent_dev_schema_registry (schema_name, branch_name, created_at, last_used_at)
      VALUES ($1, $2, now(), now())
      ON CONFLICT (schema_name)
      DO UPDATE SET last_used_at = now(), branch_name = EXCLUDED.branch_name
      `,
      [schemaName, branch],
    );
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("ent_dev_schema_registry")
    ) {
      return;
    }
    log("debug", err);
  }
}
