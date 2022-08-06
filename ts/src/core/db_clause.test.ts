import { Dialect } from "./db";
import { table, text, uuidList, TempDB, uuid } from "../testutils/db/temp_db";
import { createRowForTest } from "../testutils/write";
import { loadConfig } from "./config";
import { loadRows } from "./ent";
import * as clause from "./clause";
import { Data } from "./base";
import { v1 } from "uuid";

const tableName = "contacts";
const fields = ["id", "first_name", "last_name", "emails", "phones", "random"];

const tdb = new TempDB(Dialect.Postgres, [
  table(
    tableName,
    uuid("id", { primaryKey: true }),
    text("first_name"),
    text("last_name"),
    uuidList("emails", {
      index: {
        type: "gin",
      },
    }),
    uuidList("phones", {
      index: {
        type: "gin",
      },
    }),
    uuidList("random", {
      index: {
        type: "gin",
      },
      nullable: true,
    }),
  ),
]);

beforeAll(async () => {
  await tdb.beforeAll(false);
});

afterAll(async () => {
  await tdb.afterAll();
});

test("create + array query", async () => {
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
  let random = v1();
  for (let i = 0; i < 20; i++) {
    const data: Data = {
      id: v1(),
      first_name: "Jon",
      last_name: "Snow",
      emails: `{${[1, 2, 3, 4].map((_) => v1()).join(",")}}`,
      phones: `{${[1, 2].map((_) => v1()).join(",")}}`,
      random: null,
    };
    if (i % 3 === 0) {
      data.random = `{${random}}`;
    }
    await createRowForTest({
      tableName,
      fields: data,
    });
  }

  const randomRows = await loadRows({
    tableName,
    fields,
    clause: clause.PostgresArrayContainsValue("random", random),
  });
  expect(randomRows.length).toEqual(Math.ceil(20 / 3));

  const randomRows2 = await loadRows({
    tableName,
    fields,
    clause: clause.PostgresArrayContains("random", [random]),
  });
  expect(randomRows2.length).toEqual(Math.ceil(20 / 3));

  const randomRows3 = await loadRows({
    tableName,
    fields,
    clause: clause.PostgresArrayOverlaps("random", [random, v1()]),
  });
  expect(randomRows3.length).toEqual(Math.ceil(20 / 3));

  const row = randomRows[0];
  expect(row.emails.length).toBe(4);
  const fromSingleEmail = await loadRows({
    tableName,
    fields,
    clause: clause.PostgresArrayContainsValue("emails", row.emails[0]),
  });
  expect(fromSingleEmail.length).toBe(1);

  const fromAllEmails = await loadRows({
    tableName,
    fields,
    clause: clause.PostgresArrayContains("emails", row.emails),
  });
  expect(fromAllEmails.length).toBe(1);

  const fromEmailsOverlap = await loadRows({
    tableName,
    fields,
    clause: clause.PostgresArrayOverlaps("emails", [...row.emails, v1()]),
  });
  expect(fromEmailsOverlap.length).toBe(1);

  const notFromSingleEmail = await loadRows({
    tableName,
    fields,
    clause: clause.PostgresArrayNotContainsValue("emails", row.emails[0]),
  });
  expect(notFromSingleEmail.length).toBe(19);

  const notFromAllEmails = await loadRows({
    tableName,
    fields,
    clause: clause.PostgresArrayNotContains("emails", row.emails),
  });
  expect(notFromAllEmails.length).toBe(19);
});
