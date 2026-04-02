import "src/global_augment";
import { DB, loadConfig } from "@snowtop/ent";
import { PgVectorExtension } from "@snowtop/ent-pgvector";

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
      port: Number(process.env.POSTGRES_PORT || 54330),
      sslmode: "disable",
    },
    extensions: [PgVectorExtension()],
  });
});

afterAll(async () => {
  try {
    await DB.getInstance().endPool();
  } catch (err) {
    // ignore focused unit tests where the DB never initialized
  }
});
