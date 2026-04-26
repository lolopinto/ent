import { loadConfig } from "@snowtop/ent";

export type ExampleRuntime = "node" | "bun";
export type ExamplePostgresDriver = "pg" | "bun";

type ExampleDbConfig = {
  database?: string;
  host?: string;
  user?: string;
  password?: string;
  port?: number;
  sslmode?: string;
  max?: number;
};

type ExampleRuntimeConfig = {
  runtime: ExampleRuntime;
  postgresDriver: ExamplePostgresDriver;
  db?: ExampleDbConfig;
  dbConnectionString?: string;
};

export function loadExampleRuntimeConfig(config: ExampleRuntimeConfig) {
  loadConfig({
    ...(config.dbConnectionString
      ? { dbConnectionString: config.dbConnectionString }
      : config.db
        ? { db: config.db }
        : {}),
    runtime: config.runtime,
    postgresDriver: config.postgresDriver,
  } as any);
}
