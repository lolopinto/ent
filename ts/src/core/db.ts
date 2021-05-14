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
export declare type DBDict = Record<env, Database>;

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
    let yaml = load(data);
    if (yaml && typeof yaml === "object") {
      let cfg: customClientConfig = yaml;
      return {
        database: cfg.database,
        user: cfg.user,
        password: cfg.password,
        host: cfg.host,
        port: cfg.port,
        ssl: cfg.sslmode == "enable",
      };
    }
    throw new Error(`invalid yaml configuration in file`);
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

// this is stored in the db without timezone but we want to make sure
// it's parsed as UTC time as opposed to the local time
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, function(val: string) {
  return DateTime.fromSQL(val + "Z").toJSDate();
  // let d = new Date(val + "Z");
  // return d;
});
