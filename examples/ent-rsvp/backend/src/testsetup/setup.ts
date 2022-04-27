import { DB } from "@snowtop/ent";

afterAll(async () => {
  await DB.getInstance().endPool();
});
