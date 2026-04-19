import { DB } from "@snowtop/ent";
import { loadExampleRuntimeConfig } from "./example_runtime_config";

beforeAll(() => {
  const user = process.env.POSTGRES_USER || "";
  const password = process.env.POSTGRES_PASSWORD || "";
  const db = process.env.POSTGRES_TEST_DB;

  loadExampleRuntimeConfig({
    runtime: "bun",
    postgresDriver: "bun",
    db: {
      database: db,
      host: "localhost",
      user,
      password,
      port: 5432,
      sslmode: "disable",
    },
  });
});

afterAll(async () => {
  await DB.getInstance().endPool();
});
