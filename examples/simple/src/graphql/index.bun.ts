import { loadExampleRuntimeConfig } from "../runtime_config";

loadExampleRuntimeConfig({
  runtime: "bun",
  postgresDriver: "bun",
  dbConnectionString: process.env.DB_CONNECTION_STRING,
});

import("./index").catch((err) => {
  console.error(err);
  process.exit(1);
});
