import { Client } from "pg";
import DB from "../../core/db";
interface Column {
  name: string;
  datatype(): string;
  nullable?: boolean; // defaults to false
  primaryKey?: boolean;
}

interface Table {
  name: string;
  columns: Column[];

  create(): string;
  drop(): string;
}

type options = Pick<Column, "nullable" | "primaryKey">;

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

export function table(name: string, ...cols: Column[]): Table {
  return {
    name,
    columns: cols,
    create() {
      let colStr = cols
        .map((col) => {
          let parts = [col.name, col.datatype()];
          if (!col.nullable) {
            parts.push("NOT NULL");
          }
          if (col.primaryKey) {
            parts.push("PRIMARY KEY");
          }
          return parts.join(" ");
        })
        .join(",\n");
      return `CREATE TABLE ${name} (\n ${colStr})`;
    },
    drop() {
      return `DROP TABLE ${name}`;
    },
  };
}

function randomDB(): string {
  let str = Math.random()
    .toString(16)
    .substring(2);

  // always ensure it starts with an alpha character
  return "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)] + str;
}

export class TempDB {
  private db: string;
  private client: Client;
  private dbClient: Client;
  private tables = new Map<string, Table>();

  constructor(...tables: Table[]) {
    tables.forEach((table) => this.tables.set(table.name, table));
  }

  async beforeAll() {
    this.client = new Client({
      host: "localhost",
    });
    await this.client.connect();

    this.db = randomDB();

    await this.client.query(`CREATE DATABASE ${this.db}`);

    process.env.DB_CONNECTION_STRING = `postgres://localhost/${this.db}?`;

    try {
      this.dbClient = new Client({
        host: "localhost",
        database: this.db,
      });
      console.log(this.dbClient);
      await this.dbClient.connect();

      for (const [_, table] of this.tables) {
        await this.dbClient.query(table.create());
      }
    } catch(e) {
      console.error(e);
  }

  async afterAll() {
    try {
      // end our connection to db
      await this.dbClient.end();
      // end any pool connection
      await DB.getInstance().endPool();

      // drop db
      await this.client.query(`DROP DATABASE ${this.db}`);

      await this.client.end();
    } catch(e) {
      console.error(e);
    }
  }

  async drop(...tables: string[]) {
    for (const tableName of tables) {
      const table = this.tables.get(tableName);
      if (!table) {
        continue;
      }
      await this.dbClient.query(table.drop());
      this.tables.delete(tableName);
    }
  }

  async create(...tables: Table[]) {
    for (const table of tables) {
      if (this.tables.has(table.name)) {
        throw new Error(`table with name ${table.name} already exists`);
      }
      await this.dbClient.query(table.create());
      this.tables.set(table.name, table);
    }
  }
}
