import { TempDB, text, table, uuid } from "./test_db";

test("fkey", async () => {
  let tdb: TempDB;
  try {
    tdb = new TempDB(
      table("users", uuid("id", { primaryKey: true }), text("first_name")),
      table(
        "contacts",
        uuid("id", { primaryKey: true }),
        uuid("user_id", {
          foreignKey: {
            table: "users",
            col: "id",
          },
        }),
        text("first_name"),
      ),
    );
    await tdb.beforeAll();
  } catch (err) {
    fail(err);
  } finally {
    await tdb!.afterAll();
  }
});
