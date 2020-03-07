import { Pool, ClientConfig, PoolClient } from "pg";

function getClientConfig(): ClientConfig {
  return { database: "tsent_test", user: "ola", host: "localhost", port: 5432 };
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

  static getInstance(): DB {
    if (DB.instance) {
      return DB.instance;
    }
    // TODO get this from config/database.yml or environment variable
    DB.instance = new DB(getClientConfig());
    return DB.instance;
  }
}
