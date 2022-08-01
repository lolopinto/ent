import { Dialect } from "./db";
import { integer, table, text, TempDB } from "../testutils/db/test_db";
import { createRowForTest } from "../testutils/write";
import { loadConfig } from "./config";
import { loadRow } from "./ent";
import * as clause from "./clause";

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

test("sequential", async () => {
  const user = process.env.POSTGRES_USER || "";
  const password = process.env.POSTGRES_PASSWORD || "";
  loadConfig({
    db: {
      user,
      password,
      database: tdb.getDB(),
      host: "localhost",
    },
  });
  const data: any[] = [];
  for (let i = 0; i < 100; i++) {
    data.push({
      id: i,
      first_name: "Jon",
      last_name: "Snow",
    });
  }
  for (const datum of data) {
    await (async () => {
      await createRowForTest({
        tableName: "users",
        fields: datum,
        fieldsToLog: datum,
      });
      const r = await loadRow({
        tableName: "users",
        fields: ["id", "first_name", "last_name"],
        clause: clause.Eq("id", datum.id),
      });
      expect(r).toStrictEqual({
        id: datum.id,
        first_name: "Jon",
        last_name: "Snow",
      });
    })();
  }
});
