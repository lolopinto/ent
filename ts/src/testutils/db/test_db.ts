import { Client } from "pg";
import DB, { Connection, Dialect } from "../../core/db";
// import { open, Database } from "sqlite";
// import sqlite3 from "sqlite3";
import sqlite, { Database as SqliteDatabase } from "better-sqlite3";
import { loadConfig } from "../../core/config";
import * as fs from "fs";

interface SchemaItem {
  name: string;
}

interface Column extends SchemaItem {
  datatype(): string;
  nullable?: boolean; // defaults to false
  primaryKey?: boolean;
  default?: string;
  foreignKey?: { table: string; col: string };
}

interface Constraint extends SchemaItem {
  generate(): string;
}

export interface Table {
  name: string;
  columns: Column[];
  constraints?: Constraint[];

  create(): string;
  drop(): string;
}

type options = Pick<
  Column,
  "nullable" | "primaryKey" | "default" | "foreignKey"
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
      return "TIMESTAMP WITH TIME ZONE";
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
  return {
    name,
    datatype() {
      return "BOOLEAN";
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

function randomDB(): string {
  let str = Math.random().toString(16).substring(2);

  // always ensure it starts with an alpha character
  return "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)] + str;
}

function isDialect(dialect: Dialect | Table[]): dialect is Dialect {
  return !Array.isArray(dialect);
}

export class TempDB {
  private db: string;
  private client: Client;
  private dbClient: Client;
  private tables = new Map<string, Table>();
  private dialect: Dialect;
  private sqlite: SqliteDatabase;

  constructor(dialect: Dialect, tables: Table[]);
  constructor(tables: Table[]);
  constructor(dialect: Dialect | Table[], tables?: Table[]) {
    let tbles: Table[] = [];
    if (isDialect(dialect)) {
      this.dialect = dialect;
      if (tables) {
        tbles = tables;
      } else {
        throw new Error("tables required");
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

      this.client = new Client({
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

      this.dbClient = new Client({
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
        console.log(table.create());
        this.sqlite.exec(table.create());
      }
    }
    //    await this.sqlite.exec("nonsense");
  }

  getSqliteClient(): SqliteDatabase {
    return this.sqlite;
  }

  getDBClient() {
    if (this.dialect === Dialect.Postgres) {
      return this.dbClient;
    }
    return this.sqlite;
  }

  async afterAll() {
    if (this.dialect === Dialect.SQLite) {
      await this.sqlite.close();
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

  async drop(...tables: string[]) {
    for (const tableName of tables) {
      const table = this.tables.get(tableName);
      if (!table) {
        continue;
      }
      if (this.dialect === Dialect.Postgres) {
        await this.dbClient.query(table.drop());
      } else {
        await this.sqlite.exec(table.drop());
      }
      this.tables.delete(tableName);
    }
  }

  async create(...tables: Table[]) {
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

export function setupSqlite(connString: string, tables: Table[]) {
  let tdb: TempDB;
  beforeAll(async () => {
    (process.env.DB_CONNECTION_STRING = connString), loadConfig();
    tdb = new TempDB(Dialect.SQLite, tables);
    await tdb.beforeAll();
  });

  afterEach(async () => {
    for (const [key, _] of tdb.getTables()) {
      await (await DB.getInstance().getNewClient()).exec(`delete from ${key}`);
    }
  });

  afterAll(async () => {
    await tdb.afterAll();

    fs.rmSync(tdb.getSqliteClient().name);
  });
}
