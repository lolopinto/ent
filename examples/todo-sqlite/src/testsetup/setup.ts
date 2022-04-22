import { DB } from "@snowtop/ent";

beforeAll(() => {
  process.env.DB_CONNECTION_STRING = `sqlite:///todo.db`;
});

afterAll(async () => {
  await DB.getInstance().endPool();
});
