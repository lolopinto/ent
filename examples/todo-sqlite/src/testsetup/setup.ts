import { DB } from "@snowtop/ent";

beforeAll(() => {
  process.env.DB_CONNECTION_STRING = `sqlite:///todo22.db`;
});

afterAll(async () => {
  await DB.getInstance().endPool();
});
