import DB, { Dialect } from "./db";
import { integer, table, text, TempDB } from "../testutils/db/temp_db";
import { createRowForTest } from "../testutils/write";
import { loadConfig } from "./config";

const tdb = new TempDB(Dialect.Postgres, [
  table(
    "users",
    integer("id", { primaryKey: true }),
    text("first_name"),
    text("last_name"),
  ),
]);

beforeAll(async () => {
  await tdb.beforeAll(false);
});

afterAll(async () => {
  await tdb.afterAll();
});

test("lots of writes at once", async () => {
  const user = process.env.POSTGRES_USER || "";
  const password = process.env.POSTGRES_PASSWORD || "";

  loadConfig({
    db: {
      user,
      password,
      database: tdb.getDB(),
      max: 100,
      host: "localhost",
    },
  });
  const data: any[] = [];
  // when run with other tests, need to lower this amount
  for (let i = 0; i < 80; i++) {
    data.push({
      id: i,
      first_name: "Jon",
      last_name: "Snow",
    });
  }
  await Promise.all(
    data.map(async (d) => {
      await createRowForTest({
        tableName: "users",
        fields: d,
      });
      await DB.getInstance()
        .getPool()
        .query("select * from users where id = $1", [d.id]);
    }),
  );
});
