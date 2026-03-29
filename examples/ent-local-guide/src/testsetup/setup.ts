import "src/global_augment";
import { DB, loadConfig } from "@snowtop/ent";

beforeAll(() => {
  const db = process.env.POSTGRES_TEST_DB;
  if (!db) {
    return;
  }

  loadConfig({
    db: {
      database: db,
      host: "localhost",
      user: process.env.POSTGRES_USER || "postgres",
      password: process.env.POSTGRES_PASSWORD || "postgres",
      port: 5432,
      sslmode: "disable",
    },
  });
});

afterAll(async () => {
  try {
    await DB.getInstance().endPool();
  } catch (err) {
    // ignore cases where the DB was never initialized in a focused unit test
  }
});
