import DB, { Dialect } from "./db";
import {
  table,
  text,
  uuidList,
  TempDB,
  uuid,
  jsonb,
  integer,
} from "../testutils/db/temp_db";
import { createRowForTest } from "../testutils/write";
import { loadConfig } from "./config";
import { loadRows } from "./ent";
import * as clause from "./clause";
import { Data, LoadRowsOptions } from "./base";
import { v1 } from "uuid";
import { MockLogs } from "../testutils/mock_log";
import { setLogLevels } from "./logger";

const tableName = "contacts";
const alias = "c";
const fields = [
  "id",
  "first_name",
  "last_name",
  "emails",
  "phones",
  "random",
  "foo",
];

const tableName2 = "contacts2";
const alias2 = "c2";

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
  table(
    tableName2,
    integer("id", { primaryKey: true }),
    text("first_name"),
    text("last_name"),
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

async function verifyQueryWithAlias(options: LoadRowsOptions, a: string) {
  const rows = await loadRows(options);

  const rowsFromAlias = await loadRows({
    ...options,
    alias: a,
  });

  expect(rows.length).toEqual(rowsFromAlias.length);
  expect(rows).toStrictEqual(rowsFromAlias);

  return rows;
}

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

  const randomRows = await verifyQueryWithAlias(
    {
      tableName,
      fields,
      clause: clause.PostgresArrayContainsValue("random", random),
    },
    alias,
  );
  expect(randomRows.length).toEqual(Math.ceil(20 / 3));

  const randomRows2 = await verifyQueryWithAlias(
    {
      tableName,
      fields,
      clause: clause.PostgresArrayContains("random", [random]),
    },
    alias,
  );
  expect(randomRows2.length).toEqual(Math.ceil(20 / 3));

  const randomRows3 = await verifyQueryWithAlias(
    {
      tableName,
      fields,
      clause: clause.PostgresArrayOverlaps("random", [random, v1()]),
    },
    alias,
  );
  expect(randomRows3.length).toEqual(Math.ceil(20 / 3));

  const row = randomRows[0];
  expect(row.emails.length).toBe(4);
  const fromSingleEmail = await verifyQueryWithAlias(
    {
      tableName,
      fields,
      clause: clause.PostgresArrayContainsValue("emails", row.emails[0]),
    },
    alias,
  );
  expect(fromSingleEmail.length).toBe(1);

  const fromAllEmails = await verifyQueryWithAlias(
    {
      tableName,
      fields,
      clause: clause.PostgresArrayContains("emails", row.emails),
    },
    alias,
  );
  expect(fromAllEmails.length).toBe(1);

  const fromEmailsOverlap = await verifyQueryWithAlias(
    {
      tableName,
      fields,
      clause: clause.PostgresArrayOverlaps("emails", [...row.emails, v1()]),
    },
    alias,
  );
  expect(fromEmailsOverlap.length).toBe(1);

  const notFromSingleEmail = await verifyQueryWithAlias(
    {
      tableName,
      fields,
      clause: clause.PostgresArrayNotContainsValue("emails", row.emails[0]),
    },
    alias,
  );
  expect(notFromSingleEmail.length).toBe(19);

  const notFromAllEmails = await verifyQueryWithAlias(
    {
      tableName,
      fields,
      clause: clause.PostgresArrayNotContains("emails", row.emails),
    },
    alias,
  );
  expect(notFromAllEmails.length).toBe(19);
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

  const nullableBazRows = await verifyQueryWithAlias(
    {
      tableName,
      fields,
      // this stops at null fields
      clause: clause.Eq(clause.JSONObjectFieldKeyASJSON("foo", "baz"), null),
    },
    alias,
  );
  expect(nullableBazRows.length).toEqual(7);

  // this is actually what you want
  const nullableBazRows2 = await verifyQueryWithAlias(
    {
      tableName,
      fields,
      clause: clause.Eq(clause.JSONObjectFieldKeyAsText("foo", "baz"), null),
    },
    alias,
  );
  expect(nullableBazRows2.length).toEqual(14);

  const fooFoo1Rows = await verifyQueryWithAlias(
    {
      tableName,
      fields,
      clause: clause.Eq(clause.JSONObjectFieldKeyAsText("foo", "foo"), "foo1"),
    },
    alias,
  );
  expect(fooFoo1Rows.length).toEqual(7);

  const fooFoo2Rows = await verifyQueryWithAlias(
    {
      tableName,
      fields,
      clause: clause.Eq(clause.JSONObjectFieldKeyAsText("foo", "bar"), "bar2"),
    },
    alias,
  );
  expect(fooFoo2Rows.length).toEqual(6);

  const arrGreater5Rows = await verifyQueryWithAlias(
    {
      tableName,
      fields,
      clause: clause.JSONPathValuePredicate("foo", "$.arr[*]", 5, ">"),
    },
    alias,
  );
  expect(arrGreater5Rows.length).toEqual(6);

  const arrLess5Rows = await verifyQueryWithAlias(
    {
      tableName,
      fields,
      clause: clause.JSONPathValuePredicate("foo", "$.arr[*]", 5, "<"),
    },
    alias,
  );
  expect(arrLess5Rows.length).toEqual(7);

  const helloRows = await verifyQueryWithAlias(
    {
      tableName,
      fields,
      clause: clause.JSONPathValuePredicate("foo", "$.*", "hello", "=="),
    },
    alias,
  );
  expect(helloRows.length).toEqual(13);

  // TODO check to make sure we tested it all...
});

test("jsonb key check", async () => {
  const uuids = [v1(), v1(), v1()];
  expect(uuids.length).toBe(3);
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

    if (i % 3 === 0) {
      data.foo = {
        foo: "foo1",
        bar: "bar1",
        arr: [1, 2, 3, 4, 5],
        baz: null,
        [uuids[0]]: "hello",
      };
      if (i % 2 === 1) {
        data.foo[uuids[0]] = "hello2";
      }
      if (i % 6 === 0) {
        data.foo[uuids[0]] = {
          [uuids[1]]: "hello",
        };
      }
    }
    if (i % 3 === 1) {
      data.foo = {
        foo: "foo1",
        bar: "bar1",
        arr: [1, 2, 3, 4, 5],
        baz: null,
        [uuids[1]]: "hello",
      };
    }
    if (i % 3 === 2) {
      data.foo = {
        foo: "foo2",
        bar: "bar2",
        arr: [6, 7, 8, 9, 10],
        baz: "hello",
        [uuids[2]]: "hello",
      };
    }

    await createRowForTest({
      tableName,
      fields: data,
    });
  }

  const uuid1Rows = await verifyQueryWithAlias(
    {
      tableName,
      fields,
      clause: clause.JSONKeyExists("foo", uuids[0]),
    },
    alias,
  );
  expect(uuid1Rows.length).toEqual(7);

  // key and value
  const uuid1HelloRows = await verifyQueryWithAlias(
    {
      tableName,
      fields,
      clause: clause.And(
        clause.JSONKeyExists("foo", uuids[0]),
        clause.JSONPathValuePredicate("foo", "$.*", "hello2", "=="),
      ),
    },
    alias,
  );
  expect(uuid1HelloRows.length).toEqual(3);

  // key and value 2. more direct
  const uuid1HelloRows2 = await verifyQueryWithAlias(
    {
      tableName,
      fields,
      clause: clause.Eq(
        clause.JSONObjectFieldKeyAsText("foo", uuids[0]),
        "hello2",
      ),
    },
    alias,
  );
  expect(uuid1HelloRows2.length).toEqual(3);

  const uuid12Rows = await verifyQueryWithAlias(
    {
      tableName,
      fields,
      // nested!
      clause: clause.JSONKeyExists(
        clause.JSONObjectFieldKeyASJSON("foo", uuids[0]),
        uuids[1],
      ),
    },
    alias,
  );
  expect(uuid12Rows.length).toEqual(4);

  const uuid2Rows = await verifyQueryWithAlias(
    {
      tableName,
      fields,
      clause: clause.JSONKeyExists("foo", uuids[1]),
    },
    alias,
  );
  expect(uuid2Rows.length).toEqual(7);

  const uuid3Rows = await verifyQueryWithAlias(
    {
      tableName,
      fields,
      clause: clause.JSONKeyExists("foo", uuids[2]),
    },
    alias,
  );
  expect(uuid3Rows.length).toEqual(6);
});

test("jsonb key in list ", async () => {
  const uuids = [v1(), v1(), v1(), v1()];
  expect(uuids.length).toBe(4);
  for (let i = 0; i < 20; i++) {
    const data: Data = {
      id: v1(),
      first_name: "Jon",
      last_name: "Snow",
      emails: [],
      phones: [],
      random: null,
      foo: [
        {
          foo_id: uuids[0],
          bar: "bar1",
          arr: [1, 2, 3, 4, 5],
          baz: null,
        },
      ],
    };
    if (i % 3 === 0) {
      data.foo.push({
        foo_id: uuids[1],
        bar: "bar2",
        arr: [4, 67],
        baz: null,
      });
    }
    if (i % 3 === 1) {
      data.foo.push({
        foo_id: uuids[2],
        bar: "bar2",
        arr: [13, 2424],
        baz: null,
      });
    }

    if (i % 3 === 2) {
      data.foo.push({
        foo_id: uuids[3],
        bar: "bar2",
        arr: [],
        baz: null,
      });
    }

    data.foo = JSON.stringify(data.foo);

    await createRowForTest({
      tableName,
      fields: data,
      fieldsToLog: data,
    });
  }

  const uuid1Rows = await verifyQueryWithAlias(
    {
      tableName,
      fields,
      clause: clause.JSONBKeyInList("foo", "foo_id", uuids[0]),
    },
    alias,
  );
  // everything has uuid1
  expect(uuid1Rows.length).toEqual(20);

  const uuid2Rows = await verifyQueryWithAlias(
    {
      tableName,
      fields,
      clause: clause.JSONBKeyInList("foo", "foo_id", uuids[1]),
    },
    alias,
  );
  expect(uuid2Rows.length).toEqual(7);

  const uuid3Rows = await verifyQueryWithAlias(
    {
      tableName,
      fields,
      clause: clause.JSONBKeyInList("foo", "foo_id", uuids[2]),
    },
    alias,
  );
  expect(uuid3Rows.length).toEqual(7);

  const uuid4Rows = await verifyQueryWithAlias(
    {
      tableName,
      fields,
      clause: clause.JSONBKeyInList("foo", "foo_id", uuids[3]),
    },
    alias,
  );
  expect(uuid4Rows.length).toEqual(6);
});

test("in clause", async () => {
  const ids: string[] = [];
  const count = Math.floor(
    clause.inClause.getPostgresInClauseValuesThreshold() * 1.5,
  );
  for (let i = 0; i < count; i++) {
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
  const allIds = await verifyQueryWithAlias(
    {
      tableName,
      fields,
      clause: clause.UuidIn("id", ids),
    },
    alias,
  );
  // 1 query with alias. 1 without
  expect(ml.logs.length).toBe(2);
  expect(ml.errors.length).toBe(0);
  expect(allIds.length).toBe(count);
});

test("not in clause", async () => {
  const ids: string[] = [];
  const count = Math.floor(
    clause.inClause.getPostgresInClauseValuesThreshold() * 3,
  );
  for (let i = 0; i < count; i++) {
    const data: Data = {
      id: v1(),
      first_name: "Jon",
      last_name: "Snow",
      emails: [],
      phones: [],
      random: null,
    };
    if (i % 2 === 0) {
      ids.push(data.id);
    }
    await createRowForTest({
      tableName,
      fields: data,
    });
  }

  const ml = new MockLogs();
  ml.mock();

  setLogLevels(["query", "error"]);
  const allIds = await verifyQueryWithAlias(
    {
      tableName,
      fields,
      clause: clause.UuidNotIn("id", ids),
    },
    alias,
  );
  // 1 query with alias. 1 without
  expect(ml.logs.length).toBe(2);
  expect(ml.errors.length).toBe(0);
  expect(allIds.length).toBe(count / 2);
});

test("in clause. integer", async () => {
  const ids: number[] = [];
  const count = Math.floor(
    clause.inClause.getPostgresInClauseValuesThreshold() * 1.5,
  );
  for (let i = 0; i < count; i++) {
    const data: Data = {
      id: i + 1,
      first_name: "Jon",
      last_name: "Snow",
    };
    ids.push(data.id);
    await createRowForTest({
      tableName: tableName2,
      fields: data,
    });
  }

  const ml = new MockLogs();
  ml.mock();

  setLogLevels(["query", "error"]);
  const allIds = await verifyQueryWithAlias(
    {
      tableName: tableName2,
      fields: ["id", "first_name", "last_name"],
      clause: clause.IntegerIn("id", ids),
    },
    alias2,
  );
  // 1 query with alias. 1 without
  expect(ml.logs.length).toBe(2);
  expect(ml.errors.length).toBe(0);
  expect(allIds.length).toBe(count);
});

describe("like clauses", () => {
  const inputs = [
    {
      firstName: "Caetlyn",
      lastName: "Stark",
    },
    {
      firstName: "Eddard",
      lastName: "Stark",
    },
    {
      firstName: "Robb",
      lastName: "Stark",
    },
    {
      firstName: "Jon",
      lastName: "Snow",
    },
    {
      firstName: "Sansa",
      lastName: "Stark",
    },
    {
      firstName: "Arya",
      lastName: "Stark",
    },
    {
      firstName: "Bran",
      lastName: "Stark",
    },
    {
      firstName: "Rickon",
      lastName: "Stark",
    },
    {
      firstName: "Daenerys",
      lastName: "Targaryen",
    },
    {
      firstName: "Cersei",
      lastName: "Lannister",
    },
    {
      firstName: "Tywin",
      lastName: "Lannister",
    },
    {
      firstName: "Jaime",
      lastName: "Lannister",
    },
    {
      firstName: "Tyrion",
      lastName: "Lannister",
    },
    {
      firstName: "Robert",
      lastName: "Baratheon",
    },
    {
      firstName: "Joffrey",
      lastName: "Baratheon",
    },
    {
      firstName: "Myrcella",
      lastName: "Baratheon",
    },
    {
      firstName: "Tommen",
      lastName: "Baratheon",
    },
    {
      firstName: "Stannis",
      lastName: "Baratheon",
    },
    {
      firstName: "Shireen",
      lastName: "Baratheon",
    },
  ];

  beforeEach(async () => {
    for (const input of inputs) {
      const data: Data = {
        id: v1(),
        first_name: input.firstName,
        last_name: input.lastName,
        emails: [],
        phones: [],
        random: null,
        foo: null,
      };
      await createRowForTest({
        tableName,
        fields: data,
        fieldsToLog: data,
      });
    }
  });

  test("starts_with", async () => {
    const expected = inputs.filter((input) => input.lastName.startsWith("S"));

    const lastNameS = await verifyQueryWithAlias(
      {
        tableName,
        fields,
        clause: clause.StartsWith("last_name", "S"),
      },
      alias,
    );

    expect(lastNameS.length).toBeGreaterThan(0);
    expect(lastNameS.length).toEqual(expected.length);

    const lastNameSIgnore = await verifyQueryWithAlias(
      {
        tableName,
        fields,
        clause: clause.StartsWithIgnoreCase("last_name", "s"),
      },
      alias,
    );
    expect(lastNameSIgnore).toStrictEqual(lastNameS);
  });

  test("ends_with", async () => {
    const expected = inputs.filter((input) => input.firstName.endsWith("n"));

    const firstNameN = await verifyQueryWithAlias(
      {
        tableName,
        fields,
        clause: clause.EndsWith("first_name", "n"),
      },
      alias,
    );

    expect(firstNameN.length).toBeGreaterThan(0);
    expect(firstNameN.length).toEqual(expected.length);

    const firstNameNIgnore = await verifyQueryWithAlias(
      {
        tableName,
        fields,
        clause: clause.EndsWithIgnoreCase("first_name", "N"),
      },
      alias,
    );
    expect(firstNameNIgnore).toStrictEqual(firstNameN);
  });

  test("contains", async () => {
    const expected = inputs.filter((input) => input.firstName.includes("o"));

    const containsO = await verifyQueryWithAlias(
      {
        tableName,
        fields,
        clause: clause.Contains("first_name", "o"),
      },
      alias,
    );

    expect(containsO.length).toBeGreaterThan(0);
    expect(containsO.length).toEqual(expected.length);

    const containsOIgnore = await verifyQueryWithAlias(
      {
        tableName,
        fields,
        clause: clause.ContainsIgnoreCase("first_name", "O"),
      },
      alias,
    );
    expect(containsOIgnore).toStrictEqual(containsO);
  });
});
