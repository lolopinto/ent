import { Pool, ClientConfig, PoolClient } from "pg";
import * as fs from "fs";
import { safeLoad } from "js-yaml";

function getClientConfig(): ClientConfig | null {
  // if there's a db connection string, use that first
  const str = process.env.DB_CONNECTION_STRING;
  if (str) {
    return {
      connectionString: str,
    };
  }

  try {
    // TODO support multiple environments
    let data = fs.readFileSync("config/database.yml", { encoding: "utf8" });
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
  private static instance: DB;

  private pool: Pool;
  private constructor(config: ClientConfig) {
    this.pool = new Pool(config);
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
}
