import { loadExampleRuntimeConfig } from "../runtime_config.js";

loadExampleRuntimeConfig({
  runtime: "bun",
  postgresDriver: "bun",
  dbConnectionString: process.env.DB_CONNECTION_STRING,
});

import("./index.js").catch((err) => {
  console.error(err);
  process.exit(1);
});
