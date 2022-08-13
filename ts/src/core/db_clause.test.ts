import DB, { Dialect } from "./db";
import {
  table,
  text,
  uuidList,
  TempDB,
  uuid,
  jsonb,
} from "../testutils/db/temp_db";
import { createRowForTest } from "../testutils/write";
import { loadConfig } from "./config";
import { loadRows } from "./ent";
import * as clause from "./clause";
import { Data } from "./base";
import { v1 } from "uuid";
import { MockLogs } from "../testutils/mock_log";
import { setLogLevels } from "./logger";

const tableName = "contacts";
const fields = [
  "id",
  "first_name",
  "last_name",
  "emails",
  "phones",
  "random",
  "foo",
];

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
    jsonb("foo", {
      index: {
        type: "gin",
      },
      nullable: true,
    }),
  ),
]);

beforeAll(async () => {
  await tdb.beforeAll(false);

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
});

afterAll(async () => {
  await tdb.afterAll();
});

afterEach(async () => {
  await DB.getInstance().getPool().exec(`DELETE FROM ${tableName}`);
});

test("create + array query", async () => {
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

  //  const
});

test("jsonb", async () => {
  for (let i = 0; i < 20; i++) {
    const data: Data = {
      id: v1(),
      first_name: "Jon",
      last_name: "Snow",
      emails: [],
      phones: [],
      random: null,
      foo: null,
    };

    if (i % 3 === 1) {
      data.foo = {
        foo: "foo1",
        bar: "bar1",
        arr: [1, 2, 3, 4, 5],
        baz: null,
        wildcard: "hello",
      };
    }
    if (i % 3 === 2) {
      data.foo = {
        foo: "foo2",
        bar: "bar2",
        arr: [6, 7, 8, 9, 10],
        baz: "hello",
      };
    }

    await createRowForTest({
      tableName,
      fields: data,
    });
  }

  const nullableBazRows = await loadRows({
    tableName,
    fields,
    // this stops at null fields
    clause: clause.Eq(clause.JSONObjectFieldKeyASJSON("foo", "baz"), null),
  });
  expect(nullableBazRows.length).toEqual(7);

  // this is actually what you want
  const nullableBazRows2 = await loadRows({
    tableName,
    fields,
    clause: clause.Eq(clause.JSONObjectFieldKeyAsText("foo", "baz"), null),
  });
  expect(nullableBazRows2.length).toEqual(14);

  const fooFoo1Rows = await loadRows({
    tableName,
    fields,
    clause: clause.Eq(clause.JSONObjectFieldKeyAsText("foo", "foo"), "foo1"),
  });
  expect(fooFoo1Rows.length).toEqual(7);

  const fooFoo2Rows = await loadRows({
    tableName,
    fields,
    clause: clause.Eq(clause.JSONObjectFieldKeyAsText("foo", "bar"), "bar2"),
  });
  expect(fooFoo2Rows.length).toEqual(6);

  const arrGreater5Rows = await loadRows({
    tableName,
    fields,
    clause: clause.JSONPathValuePredicate("foo", "$.arr[*]", 5, ">"),
  });
  expect(arrGreater5Rows.length).toEqual(6);

  const arrLess5Rows = await loadRows({
    tableName,
    fields,
    clause: clause.JSONPathValuePredicate("foo", "$.arr[*]", 5, "<"),
  });
  expect(arrLess5Rows.length).toEqual(7);

  const helloRows = await loadRows({
    tableName,
    fields,
    clause: clause.JSONPathValuePredicate("foo", "$.*", "hello", "=="),
  });
  expect(helloRows.length).toEqual(13);

  // TODO check to make sure we tested it all...
});

test.only("in clause", async () => {
  const ids: string[] = [];
  for (
    let i = 0;
    // i < 70;
    i < clause.inClause.getPostgresInClauseValuesThreshold() * 1.5;
    i++
  ) {
    const data: Data = {
      id: v1(),
      first_name: "Jon",
      last_name: "Snow",
      emails: [],
      phones: [],
      random: null,
    };
    ids.push(data.id);
    await createRowForTest({
      tableName,
      fields: data,
    });
  }

  const ml = new MockLogs();
  ml.mock();

  setLogLevels(["query", "error"]);
  const allIds = await loadRows({
    tableName,
    fields,
    clause: clause.In("id", ids),
  });
  console.debug(ml.logs, ml.errors);
  console.debug(allIds.length);
});
