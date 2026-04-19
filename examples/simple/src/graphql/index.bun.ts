import { loadExampleRuntimeConfig } from "../testsetup/example_runtime_config";

loadExampleRuntimeConfig({
  runtime: "bun",
  postgresDriver: "bun",
  dbConnectionString: process.env.DB_CONNECTION_STRING,
});

await import("./index");
