import { Client as PGClient } from "pg";
import DB, { Sqlite, Dialect, Client, SyncClient } from "../../core/db";
// this should only be used in tests so we expect to be able to import without shenanigans
import sqlite, { Database as SqliteDatabase } from "better-sqlite3";
import { loadConfig } from "../../core/config";
import * as fs from "fs";
import { DBType, Field, getFields } from "../../schema";
import { snakeCase } from "snake-case";
import { BuilderSchema, getTableName } from "../builder";
import { Ent } from "../../core/base";

interface SchemaItem {
  name: string;
}

interface Column extends SchemaItem {
  datatype(): string;
  nullable?: boolean; // defaults to false
  primaryKey?: boolean;
  unique?: boolean;
  default?: string;
  foreignKey?: { table: string; col: string };
}

interface Constraint extends SchemaItem {
  generate(): string;
}

// TODO need a better shared name for Table|Type
export interface CoreConcept {
  name: string;

  create(): string;
  drop(): string;
}

export interface Table extends CoreConcept {
  columns: Column[];
  constraints?: Constraint[];
}

type options = Pick<
  Column,
  "nullable" | "primaryKey" | "default" | "foreignKey" | "unique"
>;

export function primaryKey(name: string, cols: string[]): Constraint {
  return {
    name: name,
    generate() {
      return `CONSTRAINT ${name} PRIMARY KEY(${cols.join(",")})`;
    },
  };
}

export function foreignKey(
  name: string,
  cols: string[],
  fkey: { table: string; cols: string[] },
): Constraint {
  return {
    name,
    generate() {
      return `CONSTRAINT ${name} FOREIGN KEY(${cols.join(",")}) REFERENCES ${
        fkey.table
      }(${fkey.cols.join(",")})`;
    },
  };
}

export function uniqueIndex(name: string): Constraint {
  return {
    name: "", //ignore...
    generate() {
      return `UNIQUE (${name})`;
    },
  };
}

export function uuid(name: string, opts?: options): Column {
  return {
    name,
    datatype() {
      return "uuid";
    },
    ...opts,
  };
}

export function text(name: string, opts?: options): Column {
  return {
    name,
    datatype() {
      return "TEXT";
    },
    ...opts,
  };
}

export function enumCol(name: string, type: string): Column {
  return {
    name,
    datatype() {
      return type;
    },
  };
}

export function timestamp(name: string, opts?: options): Column {
  return {
    name,
    datatype() {
      return "TIMESTAMP WITHOUT TIME ZONE";
    },
    ...opts,
  };
}

export function timestamptz(name: string, opts?: options): Column {
  return {
    name,
    datatype() {
      if (DB.getDialect() === Dialect.Postgres) {
        return "TIMESTAMP WITH TIME ZONE";
      } else {
        return "TEXT";
      }
    },
    ...opts,
  };
}

export function time(name: string, opts?: options): Column {
  return {
    name,
    datatype() {
      return "TIME WITHOUT TIME ZONE";
    },
    ...opts,
  };
}

export function timetz(name: string, opts?: options): Column {
  return {
    name,
    datatype() {
      return "TIME WITH TIME ZONE";
    },
    ...opts,
  };
}

export function date(name: string, opts?: options): Column {
  return {
    name,
    datatype() {
      return "DATE";
    },
    ...opts,
  };
}

export function bool(name: string, opts?: options): Column {
  const dialect = DB.getDialect();
  if (opts?.default === "FALSE" && dialect === Dialect.SQLite) {
    opts.default = "0";
  }
  return {
    name,
    datatype() {
      if (dialect === Dialect.Postgres) {
        return "BOOLEAN";
      }
      return "INTEGER";
    },
    ...opts,
  };
}

export function integer(name: string, opts?: options): Column {
  return {
    name,
    datatype() {
      return "INTEGER";
    },
    ...opts,
  };
}

export function float(name: string, opts?: options): Column {
  return {
    name,
    datatype() {
      return "REAL";
    },
    ...opts,
  };
}

export function json(name: string, opts?: options): Column {
  return {
    name,
    datatype() {
      return "JSON";
    },
    ...opts,
  };
}

export function jsonb(name: string, opts?: options): Column {
  return {
    name,
    datatype() {
      return "JSONB";
    },
    ...opts,
  };
}

function list(name: string, col: Column, opts?: options): Column {
  return {
    name,
    datatype() {
      return `${col.datatype()}[]`;
    },
    ...opts,
  };
}

export function textList(name: string, opts?: options): Column {
  return list(name, text(name), opts);
}

export function integerList(name: string, opts?: options): Column {
  return list(name, integer(name), opts);
}

export function uuidList(name: string, opts?: options): Column {
  return list(name, uuid(name), opts);
}

export function timestampList(name: string, opts?: options): Column {
  return list(name, timestamp(name), opts);
}

export function timestamptzList(name: string, opts?: options): Column {
  return list(name, timestamptz(name), opts);
}

export function timeList(name: string, opts?: options): Column {
  return list(name, time(name), opts);
}

export function timetzList(name: string, opts?: options): Column {
  return list(name, timetz(name), opts);
}

export function dateList(name: string, opts?: options): Column {
  return list(name, date(name), opts);
}

export function boolList(name: string, opts?: options): Column {
  return list(name, bool(name), opts);
}

export function table(name: string, ...items: SchemaItem[]): Table {
  let cols: Column[] = [];
  let constraints: Constraint[] = [];
  for (const item of items) {
    if ((item as Column).datatype !== undefined) {
      const col = item as Column;
      // add it as a constraint
      if (col.foreignKey) {
        constraints.push(
          foreignKey(`${name}_${col.name}_fkey`, [col.name], {
            table: col.foreignKey.table,
            cols: [col.foreignKey.col],
          }),
        );
      }
      cols.push(item as Column);
    } else if ((item as Constraint).generate !== undefined) {
      constraints.push(item as Constraint);
    }
  }
  return {
    name,
    columns: cols,
    constraints: constraints,
    create() {
      let schemaStr = cols.map((col) => {
        let parts = [col.name, col.datatype()];
        if (!col.nullable) {
          parts.push("NOT NULL");
        }
        if (col.primaryKey) {
          parts.push("PRIMARY KEY");
        }
        if (col.default !== undefined) {
          parts.push(`DEFAULT ${col.default}`);
        }

        if (col.unique) {
          parts.push("UNIQUE");
        }
        return parts.join(" ");
      });

      constraints.forEach((constraint) =>
        schemaStr.push(constraint.generate()),
      );

      return `CREATE TABLE IF NOT EXISTS ${name} (\n ${schemaStr})`;
    },
    drop() {
      return `DROP TABLE IF EXISTS ${name}`;
    },
  };
}

export function enumType(name: string, values: string[]): CoreConcept {
  return {
    name,
    drop() {
      return `DROP TYPE ${name}`;
    },
    create() {
      return `CREATE TYPE ${name} as ENUM(${values.join(", ")})`;
    },
  };
}

function randomDB(): string {
  let str = Math.random().toString(16).substring(2);

  // always ensure it starts with an alpha character
  return "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)] + str;
}

function isDialect(
  dialect: Dialect | Table[] | CoreConcept[],
): dialect is Dialect {
  return !Array.isArray(dialect);
}

export class TempDB {
  private db: string;
  private client: PGClient;
  private dbClient: PGClient;
  private tables = new Map<string, CoreConcept>();
  private dialect: Dialect;
  private sqlite: SqliteDatabase;

  constructor(dialect: Dialect, tables?: CoreConcept[]);
  constructor(tables: CoreConcept[]);
  constructor(dialect: Dialect | CoreConcept[], tables?: CoreConcept[]) {
    let tbles: CoreConcept[] = [];
    if (isDialect(dialect)) {
      this.dialect = dialect;
      if (tables) {
        tbles = tables;
      }
    } else {
      this.dialect = Dialect.Postgres;
      tbles = dialect;
    }
    tbles.forEach((table) => this.tables.set(table.name, table));
  }

  getDialect() {
    return this.dialect;
  }

  getTables() {
    return this.tables;
  }

  async beforeAll() {
    if (this.dialect === Dialect.Postgres) {
      const user = process.env.POSTGRES_USER || "";
      const password = process.env.POSTGRES_PASSWORD || "";

      this.client = new PGClient({
        host: "localhost",
        user,
        password,
      });
      await this.client.connect();

      this.db = randomDB();

      await this.client.query(`CREATE DATABASE ${this.db}`);

      if (user && password) {
        process.env.DB_CONNECTION_STRING = `postgres://${user}:${password}@localhost:5432/${this.db}`;
      } else {
        process.env.DB_CONNECTION_STRING = `postgres://localhost/${this.db}?`;
      }

      this.dbClient = new PGClient({
        host: "localhost",
        database: this.db,
        user,
        password,
      });
      await this.dbClient.connect();
    } else {
      if (process.env.DB_CONNECTION_STRING === undefined) {
        throw new Error(`DB_CONNECTION_STRING required for sqlite `);
      }
      const filePath = process.env.DB_CONNECTION_STRING.substr(10);
      this.sqlite = sqlite(filePath);
    }

    for (const [_, table] of this.tables) {
      if (this.dialect == Dialect.Postgres) {
        await this.dbClient.query(table.create());
      } else {
        this.sqlite.exec(table.create());
      }
    }
  }

  getSqliteClient(): SqliteDatabase {
    return this.sqlite;
  }

  getPostgresClient(): PGClient {
    return this.dbClient;
  }

  async afterAll() {
    if (this.dialect === Dialect.SQLite) {
      this.sqlite.close();
      return;
    }

    // end our connection to db
    await this.dbClient.end();
    // end any pool connection
    await DB.getInstance().endPool();

    // drop db
    await this.client.query(`DROP DATABASE ${this.db}`);

    await this.client.end();
  }

  async dropAll() {
    for (const [t, _] of this.tables) {
      await this.drop(t);
    }
  }

  async drop(...tables: string[]) {
    for (const tableName of tables) {
      const table = this.tables.get(tableName);
      if (!table) {
        continue;
      }
      if (this.dialect === Dialect.Postgres) {
        await this.dbClient.query(table.drop());
      } else {
        this.sqlite.exec(table.drop());
      }
      this.tables.delete(tableName);
    }
  }

  async create(...tables: CoreConcept[]) {
    for (const table of tables) {
      if (this.tables.has(table.name)) {
        throw new Error(`table with name ${table.name} already exists`);
      }
      if (this.dialect === Dialect.Postgres) {
        await this.dbClient.query(table.create());
      } else {
        this.sqlite.exec(table.create());
      }
      this.tables.set(table.name, table);
    }
  }
}

export function assoc_edge_config_table() {
  return table(
    "assoc_edge_config",
    // edge_type and inverse_edge_type are text intentionally instead of uuid...
    text("edge_type", { primaryKey: true }),
    text("edge_name"),
    bool("symmetric_edge", { default: "FALSE" }),
    text("inverse_edge_type", { nullable: true }),
    text("edge_table"),
    timestamptz("created_at"),
    timestamptz("updated_at"),
  );
}

export function assoc_edge_table(name: string) {
  return table(
    name,
    uuid("id1"),
    text("id1_type"),
    // same as in assoc_edge_config_table
    text("edge_type"),
    uuid("id2"),
    text("id2_type"),
    timestamptz("time"),
    text("data", { nullable: true }),
    primaryKey(`${name}_pkey`, ["id1", "id2", "edge_type"]),
  );
}

interface sqliteSetupOptions {
  disableDeleteAfterEachTest?: boolean;
}
export function setupSqlite(
  connString: string,
  tables: () => Table[],
  opts?: sqliteSetupOptions,
) {
  let tdb: TempDB;
  beforeAll(async () => {
    process.env.DB_CONNECTION_STRING = connString;
    loadConfig();
    tdb = new TempDB(Dialect.SQLite, tables());
    await tdb.beforeAll();

    const conn = DB.getInstance().getConnection();
    expect((conn as Sqlite).db.memory).toBe(false);
  });

  if (!opts?.disableDeleteAfterEachTest) {
    afterEach(async () => {
      const client = await DB.getInstance().getNewClient();
      for (const [key, _] of tdb.getTables()) {
        const query = `delete from ${key}`;
        if (isSyncClient(client))
          if (client.execSync) {
            client.execSync(query);
          } else {
            await client.exec(query);
          }
      }
    });
  }

  afterAll(async () => {
    await tdb.afterAll();

    fs.rmSync(tdb.getSqliteClient().name);
  });
}

export function getSchemaTable(schema: BuilderSchema<Ent>, dialect: Dialect) {
  const fields = getFields(schema);

  const columns: Column[] = [];
  for (const [_, field] of fields) {
    columns.push(getColumnFromField(field, dialect));
  }
  return table(getTableName(schema), ...columns);
}

function getColumnForDbType(
  t: DBType,
  dialect: Dialect,
): ((name: string) => Column) | undefined {
  switch (t) {
    case DBType.UUID:
      if (dialect === Dialect.Postgres) {
        return uuid;
      }
      return text;
    case DBType.Int64ID:
    case DBType.Int:
      return integer;
    case DBType.Boolean:
      return bool;
    case DBType.Timestamp:
      return timestamp;
    case DBType.Timestamptz:
      return timestamptz;
    case DBType.String:
    case DBType.StringEnum:
      return text;
    case DBType.Float:
      return float;
    case DBType.Date:
      return date;
    case DBType.Time:
      return time;
    case DBType.Timetz:
      return timetz;
    case DBType.JSONB:
      return jsonb;
    case DBType.JSON:
      return json;

    default:
      return undefined;
  }
}

function getColumnFromField(f: Field, dialect: Dialect) {
  switch (f.type.dbType) {
    case DBType.List:
      const elemType = f.type.listElemType;
      if (elemType === undefined) {
        throw new Error(`unsupported list type with no elem type`);
      }
      const elemFn = getColumnForDbType(elemType.dbType, dialect);
      if (elemFn === undefined) {
        throw new Error(`unsupported type for ${elemType}`);
      }
      return list(storageKey(f), elemFn("ignore"), buildOpts(f));

    default:
      const fn = getColumnForDbType(f.type.dbType, dialect);
      if (fn === undefined) {
        throw new Error(`unsupported type ${f.type.dbType}`);
      }
      return getColumn(f, fn);
  }
}

function getColumn(f: Field, col: (name: string, opts?: options) => Column) {
  return col(storageKey(f), buildOpts(f));
}

function buildOpts(f: Field): options {
  let ret: options = {};
  if (f.primaryKey) {
    ret.primaryKey = true;
  }
  if (f.nullable) {
    ret.nullable = true;
  }
  if (f.foreignKey !== undefined) {
    console.error("TODO:foreign key not yet converted");
    //    ret.foreignKey =
  }
  if (f.serverDefault) {
    ret.default = f.serverDefault;
  }
  return ret;
}

function storageKey(f: Field): string {
  if (f.storageKey) {
    return f.storageKey;
  }

  return snakeCase(f.name);
}

function isSyncClient(client: Client): client is SyncClient {
  return (client as SyncClient).execSync !== undefined;
}
