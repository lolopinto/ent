import { DB, loadConfig } from "@snowtop/ent";

beforeAll(() => {
  const user = process.env.POSTGRES_USER || "";
  const password = process.env.POSTGRES_PASSWORD || "";
  const db = process.env.POSTGRES_TEST_DB;

  loadConfig({
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
