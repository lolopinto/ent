import pg, { Pool, ClientConfig, PoolClient } from "pg";
import * as fs from "fs";
import { safeLoad } from "js-yaml";
import { log } from "./logger";

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
export declare type DBDict = Record<env, Database>;

function isDbDict(v: Database | DBDict): v is DBDict {
  return (
    v["production"] !== undefined ||
    v["development"] !== undefined ||
    v["test"] !== undefined
  );
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
}): ClientConfig | null {
  // if there's a db connection string, use that first
  const str = process.env.DB_CONNECTION_STRING;
  if (str) {
    return {
      connectionString: str,
    };
  }

  let file = "config/database.yml";
  if (args) {
    if (args.connectionString) {
      return {
        connectionString: args.connectionString,
      };
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
      return db;
    }

    if (args.dbFile) {
      file = args.dbFile;
    }
  }

  try {
    // TODO support multiple environments in database/config.yaml file.
    // if needed for now, general yaml file should be used
    let data = fs.readFileSync(file, { encoding: "utf8" });
    let yaml = safeLoad(data);
    if (yaml) {
      return {
        database: yaml.database,
        user: yaml.user,
        password: yaml.password,
        host: yaml.host,
        port: yaml.port,
        ssl: yaml.sslmode == "enable",
      };
    }
  } catch (e) {
    console.error("error reading file" + e.message);
    return null;
  }
  return null;
}

export default class DB {
  static instance: DB;

  private pool: Pool;
  private constructor(public config: ClientConfig) {
    this.pool = new Pool(config);

    this.pool.on("error", (err, client) => {
      log("error", err);
    });
  }

  getPool(): Pool {
    return this.pool;
  }

  // expect to release client as needed
  async getNewClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  // this should be called when the server is shutting down or end of tests.
  async endPool(): Promise<void> {
    return this.pool.end();
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
    return DB.instance;
  }

  static initDB(args?: {
    connectionString?: string;
    dbFile?: string;
    db?: Database | DBDict;
  }) {
    const config = getClientConfig(args);
    if (config) {
      DB.instance = new DB(config);
    }
  }
}

export const defaultTimestampParser = pg.types.getTypeParser(
  pg.types.builtins.TIMESTAMP,
);
// add (UTC) timezone to it so it's parsed as UTC time correctly
pg.types.builtins.TIMESTAMP;
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, function(val: string) {
  let d = new Date(val + "Z");
  return d;
});

// tell pg to treat this as UTC time when parsing and store it that way
//(pg.defaults as any).parseInputDatesAsUTC = true;
