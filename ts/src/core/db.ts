import pg, { Pool, ClientConfig, PoolClient } from "pg";
import * as fs from "fs";
import { load } from "js-yaml";
import { log } from "./logger";
import { DateTime } from "luxon";

export interface Database {
  database?: string;
  user?: string;
  password?: string;
  host?: string;
  port?: number;
  ssl?: boolean;
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

interface customClientConfig extends ClientConfig {
  sslmode?: string;
}

export enum Dialect {
  Postgres = "postgres",
  SQLite = "sqlite",
}

function parseConnectionString(str: string): DatabaseInfo {
  if (str.startsWith("sqlite:///")) {
    let filePath = str.substr(10);

    return {
      dialect: Dialect.SQLite,
      config: {
        connectionString: str,
      },
      filePath,
    };
  }

  return {
    dialect: Dialect.Postgres,
    config: {
      connectionString: str,
    },
  };
}

interface DatabaseInfo {
  dialect: Dialect;
  config: ClientConfig;
  /// filePath for sqlite
  filePath?: string;
}

// order
// env variable
// connString in config
// db in Config file (helpful for test vs development)
// database file in yml file
// database/config.yml
function getClientConfig(args?: {
  connectionString?: string;
  dbFile?: string;
  db?: Database | DBDict;
}): DatabaseInfo | null {
  // if there's a db connection string, use that first
  const str = process.env.DB_CONNECTION_STRING;
  if (str) {
    return parseConnectionString(str);
  }

  let file = "config/database.yml";
  if (args) {
    if (args.connectionString) {
      return parseConnectionString(args.connectionString);
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
      let cfg: customClientConfig = yaml;
      return {
        dialect: Dialect.Postgres,
        config: {
          database: cfg.database,
          user: cfg.user,
          password: cfg.password,
          host: cfg.host,
          port: cfg.port,
          ssl: cfg.sslmode == "enable",
        },
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
    if (db.dialect === Dialect.Postgres) {
      this.pool = new Pool(db.config);
      this.q = new Postgres(this.pool);

      this.pool.on("error", (err, client) => {
        log("error", err);
      });
    } else {
      let sqlite = require("better-sqlite3");
      this.q = new Sqlite(sqlite(db.filePath || ""));
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

  async getSQLiteClient(): Promise<Sqlite> {
    if (this.db.dialect == Dialect.Postgres) {
      throw new Error(`can't call getSQLiteClient when dialect is postgres`);
    }
    return this.q as Sqlite;
  }

  // this should be called when the server is shutting down or end of tests.
  async endPool(): Promise<void> {
    return this.q.close();
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

  static initDB(args?: {
    connectionString?: string;
    dbFile?: string;
    db?: Database | DBDict;
  }) {
    const config = getClientConfig(args);
    if (config) {
      DB.instance = new DB(config);
      DB.dialect = DB.instance.db.dialect;
    }
  }
}

export const defaultTimestampParser = pg.types.getTypeParser(
  pg.types.builtins.TIMESTAMP,
);

// this is stored in the db without timezone but we want to make sure
// it's parsed as UTC time as opposed to the local time
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, function (val: string) {
  return DateTime.fromSQL(val + "Z").toJSDate();
  // let d = new Date(val + "Z");
  // return d;
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
  constructor(private pool: Pool) {}

  self() {
    return this;
  }

  // returns new Pool client
  async newClient() {
    const client = await this.pool.connect();
    if (!client) {
      throw new Error(`couldn't get new client`);
    }
    return new PostgresClient(client);
  }

  async query(
    query: string,
    values?: any[],
  ): Promise<QueryResult<QueryResultRow>> {
    const r = await this.pool.query(query, values);
    return r;
  }

  async queryAll(
    query: string,
    values?: any[],
  ): Promise<QueryResult<QueryResultRow>> {
    const r = await this.pool.query(query, values);
    return r;
  }

  async exec(query: string, values?: any[]): Promise<ExecResult> {
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
  constructor(private client: PoolClient) {}

  async query(
    query: string,
    values?: any[],
  ): Promise<QueryResult<QueryResultRow>> {
    const r = await this.client.query(query, values);
    return r;
  }

  async queryAll(
    query: string,
    values?: any[],
  ): Promise<QueryResult<QueryResultRow>> {
    const r = await this.client.query(query, values);
    return r;
  }

  async exec(query: string, values?: any[]): Promise<ExecResult> {
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
