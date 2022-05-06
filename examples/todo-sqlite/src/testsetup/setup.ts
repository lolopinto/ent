import { DB, loadConfig } from "@snowtop/ent";

beforeAll(() => {
  process.env.DB_CONNECTION_STRING = `sqlite:///todo.db`;
  loadConfig({
    // log: "query",
  });
});

afterAll(async () => {
  await DB.getInstance().endPool();
});
