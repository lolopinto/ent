import DB, { Dialect } from "./db";
import {
  table,
  text,
  uuidList,
  TempDB,
  uuid,
  jsonb,
  integer,
  assoc_edge_config_table,
  assoc_edge_table,
} from "../testutils/db/temp_db";
import { createRowForTest } from "../testutils/write";
import { loadConfig } from "./config";
import { AssocEdge, loadEdges, loadRows, loadTwoWayEdges } from "./ent";
import * as clause from "./clause";
import { Data, ID, LoadRowsOptions } from "./base";
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

const tableName3 = "contact_infos";
const alias3 = "ci";
const fields3 = ["id", "name", "contact_id"];

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
  table(
    tableName3,
    uuid("id", { primaryKey: true }),
    text("name"),
    uuid("contact_id", {
      index: true,
    }),
  ),
  assoc_edge_config_table(),
  assoc_edge_table("edge_table"),
]);

//TODO need to centralize this somewhere. some version of this has been duplicated in a few places
async function createEdgeRows(edges: string[], table?: string) {
  for (const edge of edges) {
    await createRowForTest({
      tableName: "assoc_edge_config",
      fields: {
        edge_table: table ?? `${edge}_table`,
        symmetric_edge: false,
        inverse_edge_type: null,
        edge_type: edge,
        edge_name: "name",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });
  }
}

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

  await createEdgeRows(["edge"]);
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

describe("like clauses", () => {
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

test("join on multiple", async () => {
  const rows: Data[] = [];
  for (let i = 0; i < 11; i++) {
    const data: Data = {
      id: v1(),
      first_name: inputs[i].firstName,
      last_name: inputs[i].lastName,
      emails: [],
      phones: [],
      random: null,
      foo: null,
    };

    const row = await createRowForTest(
      {
        tableName,
        fields: data,
        fieldsToLog: data,
      },
      "RETURNING *",
    );

    console.assert(row, "row should be created");

    await createRowForTest({
      tableName: tableName3,
      fields: {
        id: v1(),
        name: `${row!.first_name} ${row!.last_name} test`,
        contact_id: row!.id,
      },
    });
    rows.push(row!);
  }

  const row = rows[0];
  const twoWayIds: ID[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row2 = rows[i];
    // add row in edge table
    await createRowForTest({
      tableName: "edge_table",
      fields: {
        id1: row.id,
        id1_type: "Contact",
        id2: row2.id,
        id2_type: "Contact",
        time: new Date().toISOString(),
        edge_type: "edge",
        data: null,
      },
    });
    if (i % 2 === 0) {
      twoWayIds.push(row2.id);
      // add inverse edge in edge table
      await createRowForTest({
        tableName: "edge_table",
        fields: {
          id2: row.id,
          id1_type: "Contact",
          id1: row2.id,
          id2_type: "Contact",
          time: new Date().toISOString(),
          edge_type: "edge",
          data: null,
        },
      });
    }
  }

  const edges = await loadEdges({
    edgeType: "edge",
    id1: row.id,
  });
  expect(edges.length).toBe(10);

  const twoWay = await loadTwoWayEdges({
    edgeType: "edge",
    id1: row.id,
    ctr: AssocEdge,
  });
  expect(twoWay.length).toBe(5);
  expect(twoWay.map((e) => e.id2)).toStrictEqual(twoWayIds);

  // getting contact_infos for 2-way connections
  const contact_infos = await loadRows({
    tableName: "edge_table",
    fields: fields3,
    alias: "et1",
    // we're getting contact_infos so fieldsAlias uses that even though the FROM table is edge_table
    fieldsAlias: "ci",
    join: [
      {
        tableName: "edge_table",
        alias: "et2",
        clause: clause.And(
          clause.Expression(`et1.id1 = et2.id2`),
          clause.Expression(`et2.id1 = et1.id2`),
        ),
      },
      {
        tableName: tableName3,
        alias: "ci",
        clause: clause.Expression(`et1.id2 = ci.contact_id`),
      },
    ],
    clause: clause.Eq("id1", row.id),
  });

  // same as 2-way
  expect(contact_infos.length).toBe(5);
  expect(contact_infos.map((ci) => ci.contact_id)).toStrictEqual(twoWayIds);

  // this is the query we're trying to do above...
  const r = await DB.getInstance()
    .getPool()
    .query(
      "select ci.id, ci.name, ci.contact_id from edge_table t1 join edge_table t2 on t1.id1 = t2.id2 and t2.id1 = t1.id2 join contact_infos ci on t1.id2 = ci.contact_id where t1.id1 = $1",
      [row.id],
    );
  const contact_infos2 = r.rows;
  expect(contact_infos).toStrictEqual(contact_infos2);
});
