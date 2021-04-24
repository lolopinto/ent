import { Client } from "pg";
import DB from "../../core/db";

interface SchemaItem {
  name: string;
}

interface Column extends SchemaItem {
  datatype(): string;
  nullable?: boolean; // defaults to false
  primaryKey?: boolean;
  default?: string;
  //  foreignKey?: string; // TODO...
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

type options = Pick<Column, "nullable" | "primaryKey" | "default">;

export function primaryKey(name: string, cols: string[]): Constraint {
  return {
    name: name,
    generate() {
      return `CONSTRAINT ${name} PRIMARY KEY(${cols.join(",")})`;
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

export function table(name: string, ...items: SchemaItem[]): Table {
  let cols: Column[] = [];
  let constraints: Constraint[] = [];
  for (const item of items) {
    if ((item as Column).datatype !== undefined) {
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

      return `CREATE TABLE ${name} (\n ${schemaStr})`;
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
    console.log(this.db, DB.instance);

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

    for (const [_, table] of this.tables) {
      await this.dbClient.query(table.create());
    }
  }

  async afterAll() {
    // end our connection to db
    //    console.log("end connection");
    await this.dbClient.end();
    // end any pool connection
    // console.log("end pool");
    // console.log(DB.getInstance());
    await DB.getInstance().endPool();

    // drop db
    //    console.log("drop db");
    await this.client.query(`DROP DATABASE ${this.db}`);

    //    console.log("bye client");
    await this.client.end();
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
