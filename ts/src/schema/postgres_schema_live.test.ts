import { v1, v4 as uuidv4 } from "uuid";
import pg from "pg";
import * as fs from "fs";
import * as path from "path";
import each from "jest-each";
import { LoggedOutViewer } from "../core/viewer";
import {
  StringType,
  TimeType,
  TimetzType,
  UUIDType,
  DateType,
  TimestamptzType,
  UUIDListType,
} from "./field";
import Schema from "./schema";
import {
  User,
  SimpleAction,
  getBuilderSchemaFromFields,
  getBuilderSchemaTZFromFields,
  BuilderSchema,
} from "../testutils/builder";
import {
  table,
  TempDB,
  text,
  timestamp,
  timestamptz,
  uuid,
  getSchemaTable,
  uuidList,
} from "../testutils/db/temp_db";
import { defaultTimestampParser, Dialect } from "../core/db";
import { DBType, FieldMap } from "./schema";
import { AlwaysAllowPrivacyPolicy } from "../core/privacy";
import { ID, Ent, Viewer, Data, PrivacyPolicy } from "../core/base";
import { WriteOperation } from "../action";
import { DBTimeZone } from "../testutils/db_time_zone";

const UserSchema = getBuilderSchemaFromFields(
  {
    FirstName: StringType(),
    LastName: StringType(),
  },
  User,
);

const UserWithTimezoneSchema = getBuilderSchemaTZFromFields(
  {
    FirstName: StringType(),
    LastName: StringType(),
  },
  User,
);

class UserWithTimestampNoFormatSchema implements Schema {
  fields: FieldMap = {
    ID: UUIDType({
      primaryKey: true,
      defaultValueOnCreate: () => {
        return uuidv4();
      },
    }),
    FirstName: StringType(),
    LastName: StringType(),
    // manual timestamps. no formatting that comes with TimestampType
    createdAt: {
      type: {
        dbType: DBType.Timestamp,
      },
      defaultValueOnCreate: () => {
        return new Date();
      },
      logValue: (val) => val,
    },
    updatedAt: {
      type: {
        dbType: DBType.Timestamp,
      },
      defaultValueOnCreate: () => {
        return new Date();
      },
      logValue: (val) => val,
    },
  };
  ent = User;
}

async function createRegUsers() {
  await tdb.create(
    table(
      "users",
      uuid("id", { primaryKey: true }),
      text("first_name"),
      text("last_name"),
      timestamp("created_at"),
      timestamp("updated_at"),
    ),
  );
}

async function createUsersWithTZ() {
  await tdb.create(
    table(
      "users",
      uuid("id", { primaryKey: true }),
      text("first_name"),
      text("last_name"),
      timestamptz("created_at"),
      timestamptz("updated_at"),
    ),
  );
}

let tdb: TempDB;
beforeAll(async () => {
  tdb = new TempDB(Dialect.Postgres, []);

  await tdb.beforeAll();
});

afterAll(async () => {
  await tdb.afterAll();
});

afterEach(async () => {
  await tdb.drop("users");
});

function getInsertAction<T extends Ent>(
  schema: BuilderSchema<T>,
  map: Map<string, any>,
) {
  return new SimpleAction(
    new LoggedOutViewer(),
    schema,
    map,
    WriteOperation.Insert,
    null,
  );
}

describe("timestamp", () => {
  beforeEach(async () => {
    await createRegUsers();
  });

  test("standard", async () => {
    const date = new Date();
    const action = getInsertAction(
      UserSchema,
      new Map<string, any>([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
        // set the createdAt and updatedAt values so we don't depend on how long it takes before this is called later...
        ["createdAt", date],
        ["updatedAt", date],
      ]),
    );
    const user = await action.saveX();
    const createdAt: Date = user.data.created_at;
    const updatedAt: Date = user.data.updated_at;

    // created at and updated at even though stored in utc with timestamp without timezone
    // when retrieved, we get a timestamp that's close to what we expect.
    expect(createdAt.getTime()).toBe(date.getTime());
    expect(updatedAt.getTime()).toBe(date.getTime());
  });

  test("no setTypeParser", async () => {
    const date = new Date();
    const action = getInsertAction(
      UserSchema,
      new Map<string, any>([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
        // set the createdAt and updatedAt values so we don't depend on how long it takes before this is called later...
        ["createdAt", date],
        ["updatedAt", date],
      ]),
    );

    // reset to default ts parser
    const prevParser = pg.types.getTypeParser(pg.types.builtins.TIMESTAMP);
    pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, defaultTimestampParser);

    const user = await action.saveX();
    const createdAt: Date = user.data.created_at;
    const updatedAt: Date = user.data.updated_at;

    // with default parser, value we get back is off
    expect(
      Math.abs(createdAt.getTime() - date.getTime()),
    ).toBeGreaterThanOrEqual(date.getTimezoneOffset() * 60000);
    expect(
      Math.abs(updatedAt.getTime() - date.getTime()),
    ).toBeGreaterThanOrEqual(date.getTimezoneOffset() * 60000);
    expectWithinTZ(createdAt, date);
    expectWithinTZ(updatedAt, date);

    // restore parser
    pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, prevParser);
  });

  function expectWithinTZ(date1: Date, date2: Date) {
    let diff = Math.abs(date1.getTime() - date2.getTime());
    let offset = date1.getTimezoneOffset() * 60000;
    expect(offset - diff).toBe(0);
  }

  test("no toISO formattting", async () => {
    const date = new Date();
    const action = getInsertAction(
      new UserWithTimestampNoFormatSchema(),
      new Map<string, any>([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
        // set the createdAt and updatedAt values so we don't depend on how long it takes before this is called later...
        ["createdAt", date],
        ["updatedAt", date],
      ]),
    );
    const user = await action.saveX();
    const createdAt: Date = user.data.created_at;
    const updatedAt: Date = user.data.updated_at;

    // difference btw date not in db and value stored is within tz differences
    expectWithinTZ(createdAt, date);
    expectWithinTZ(updatedAt, date);
  });

  test("neither toISO formatting nor new parser", async () => {
    const date = new Date();
    const action = getInsertAction(
      new UserWithTimestampNoFormatSchema(),
      new Map<string, any>([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
        // set the createdAt and updatedAt values so we don't depend on how long it takes before this is called later...
        ["createdAt", date],
        ["updatedAt", date],
      ]),
    );
    // reset to default ts parser
    const prevParser = pg.types.getTypeParser(pg.types.builtins.TIMESTAMP);
    pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, defaultTimestampParser);

    const user = await action.saveX();
    const createdAt: Date = user.data.created_at;
    const updatedAt: Date = user.data.updated_at;

    // this is fine but depends on db and node server being in sync
    // don't currently have a good way to test this so showing this in action
    expect(createdAt.getTime()).toBe(date.getTime());
    expect(updatedAt.getTime()).toBe(date.getTime());

    // restore parser
    pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, prevParser);
  });
});

test("timestamptz", async () => {
  await createUsersWithTZ();
  const date = new Date();
  const action = getInsertAction(
    UserWithTimezoneSchema,
    new Map<string, any>([
      ["FirstName", "Jon"],
      ["LastName", "Snow"],
      // set the createdAt and updatedAt values so we don't depend on how long it takes before this is called later...
      ["createdAt", date],
      ["updatedAt", date],
    ]),
  );

  const user = await action.saveX();
  const createdAt: Date = user.data.created_at;
  const updatedAt: Date = user.data.updated_at;

  // stored with timezone. no formatting is done and no magic is done and we get what we want back
  expect(createdAt.getTime()).toBe(date.getTime());
  expect(updatedAt.getTime()).toBe(updatedAt.getTime());

  expect(date.getTimezoneOffset()).toBe(createdAt.getTimezoneOffset());
  expect(date.getTimezoneOffset()).toBe(updatedAt.getTimezoneOffset());
});

class Hours implements Ent {
  id: ID;
  accountID: string;
  nodeType = "Hours";
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return AlwaysAllowPrivacyPolicy;
  }

  constructor(public viewer: Viewer, public data: Data) {
    this.id = data.id;
  }
}

const HoursSchema = getBuilderSchemaFromFields(
  {
    // should be an enum but let's ignore that
    dayOfWeek: StringType(),
    open: TimeType(),
    close: TimeType(),
  },
  Hours,
);

const HoursTZSchema = getBuilderSchemaTZFromFields(
  {
    // should be an enum but let's ignore that
    dayOfWeek: StringType(),
    open: TimetzType(),
    close: TimetzType(),
  },
  Hours,
);

describe("time", () => {
  beforeAll(async () => {
    await createTimeTable();
  });

  afterAll(async () => {
    await tdb.drop("hours");
  });

  async function createTimeTable() {
    await tdb.create(getSchemaTable(HoursSchema, Dialect.Postgres));
  }

  test("date object", async () => {
    const open = new Date();
    open.setHours(8, 0, 0, 0);

    const close = new Date();
    close.setHours(17, 0, 0, 0);
    const action = getInsertAction(
      HoursSchema,
      new Map<string, any>([
        ["dayOfWeek", "sunday"],
        ["open", open],
        ["close", close],
      ]),
    );

    const hours = await action.saveX();
    expect(hours.data.open).toEqual("08:00:00");
    expect(hours.data.close).toEqual("17:00:00");
  });

  test("time format", async () => {
    const action = getInsertAction(
      HoursSchema,
      new Map<string, any>([
        ["dayOfWeek", "sunday"],
        ["open", "8:00 AM"],
        ["close", "5:00 PM"],
      ]),
    );

    const hours = await action.saveX();
    expect(hours.data.open).toEqual("08:00:00");
    expect(hours.data.close).toEqual("17:00:00");
  });
});

describe("timetz", () => {
  beforeAll(async () => {
    await createTimeTable();
  });

  afterAll(async () => {
    await tdb.drop("hours");
  });

  async function createTimeTable() {
    await tdb.create(getSchemaTable(HoursTZSchema, Dialect.Postgres));
  }

  test("date object", async () => {
    const open = new Date();
    open.setHours(8);
    open.setMinutes(0);
    open.setSeconds(0);
    open.setMilliseconds(0);

    const close = new Date();
    close.setHours(17);
    close.setMinutes(0);
    close.setSeconds(0);
    close.setMilliseconds(0);
    const action = getInsertAction(
      HoursTZSchema,
      new Map<string, any>([
        ["dayOfWeek", "sunday"],
        ["open", open],
        ["close", close],
      ]),
    );

    let offset = await DBTimeZone.getDateOffset(open);

    const hours = await action.saveX();
    expect(hours.data.open).toEqual(`08:00:00${offset}`);
    expect(hours.data.close).toEqual(`17:00:00${offset}`);
  });

  test("time format", async () => {
    const action = getInsertAction(
      HoursSchema,
      new Map<string, any>([
        ["dayOfWeek", "sunday"],
        ["open", "8:00 AM"],
        ["close", "5:00 PM"],
      ]),
    );

    const d = new Date();
    let offset = await DBTimeZone.getDateOffset(d);

    const hours = await action.saveX();
    expect(hours.data.open).toEqual(`08:00:00${offset}`);
    expect(hours.data.close).toEqual(`17:00:00${offset}`);
  });
});

class Holiday implements Ent {
  id: ID;
  accountID: string;
  nodeType = "Holiday";
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return AlwaysAllowPrivacyPolicy;
  }
  constructor(public viewer: Viewer, public data: Data) {
    this.id = data.id;
  }
}

const HolidaySchema = getBuilderSchemaFromFields(
  {
    // should be an enum but let's ignore that
    label: StringType(),
    date: DateType(),
  },
  Holiday,
);

describe("date", () => {
  beforeAll(async () => {
    await createHolidaysTable();
  });

  afterAll(async () => {
    await tdb.drop("hours");
  });

  async function createHolidaysTable() {
    await tdb.create(getSchemaTable(HolidaySchema, Dialect.Postgres));
  }

  // for some reason, a Date object is returned here and it accounts for timezone
  // parsing in this format seems to work consistently
  // parsing with "2021-01-20" doesn't...
  const getInaugauration = () => {
    return new Date(Date.parse("January 20, 2021"));
  };

  const expectedValue = () => {
    return getInaugauration();
  };

  test("date object", async () => {
    const action = getInsertAction(
      HolidaySchema,
      new Map<string, any>([
        ["label", "inaugaration"],
        ["date", getInaugauration()],
      ]),
    );

    const holiday = await action.saveX();

    expect(holiday.data.date).toEqual(expectedValue());
  });

  test("date format", async () => {
    const action = getInsertAction(
      HolidaySchema,
      new Map<string, any>([
        ["label", "inaugaration"],
        ["date", "2021-01-20"],
      ]),
    );

    const holiday = await action.saveX();
    expect(holiday.data.date).toEqual(expectedValue());
  });

  test("date timestamp", async () => {
    const action = getInsertAction(
      HolidaySchema,
      new Map<string, any>([
        ["label", "inaugaration"],
        ["date", getInaugauration().getTime()],
      ]),
    );

    const holiday = await action.saveX();
    expect(holiday.data.date).toEqual(expectedValue());
  });
});

test("timestamptz copy", async () => {
  // lame version of skip for ci since test is failing
  // TODO: https://github.com/lolopinto/ent/issues/294
  if (process.env.NODE_AUTH_TOKEN) {
    return;
  }
  await createUsersWithTZ();

  const file = path.join(
    process.cwd(),
    Math.random().toString(16).substring(2),
  );

  const tzType = TimestamptzType();
  const date = new Date();
  const rows = [
    ["id", "first_name", "last_name", "created_at", "updated_at"],
    [uuidv4(), "Jon", "Snow", tzType.format(date), tzType.format(date)],
  ];

  let lines: string[] = [];

  for (const row of rows) {
    lines.push(row.join(","));
  }

  fs.writeFileSync(file, lines.join("\n"));

  try {
    const client = tdb.getPostgresClient();

    const query = `COPY users (${rows[0].join(",")}) FROM '${file}' CSV HEADER`;
    await client.query(query);

    const r = await client.query("SELECT COUNT(1) FROM users");
    expect(r.rowCount).toBe(1);
    const row = r.rows[0];
    expect(row.count).toBe("1");
  } catch (err) {
    throw new Error(err);
  } finally {
    fs.rmSync(file, {
      force: true,
      recursive: true,
    });
  }
});

each([
  ["v1", v1],
  ["v4", uuidv4],
]).test("uuid list %s", async (name: string, fn: () => string) => {
  await tdb.create(
    table(
      "tables",
      uuid("id", { primaryKey: true }),
      uuidList("list"),
      timestamp("created_at"),
      timestamp("updated_at"),
    ),
  );

  class Table implements Ent {
    id: ID;
    accountID: string;
    nodeType = "Table";
    getPrivacyPolicy(): PrivacyPolicy<this> {
      return AlwaysAllowPrivacyPolicy;
    }

    constructor(public viewer: Viewer, public data: Data) {
      this.id = data.id;
    }
  }

  const TableSchema = getBuilderSchemaFromFields(
    {
      id: UUIDType(),
      list: UUIDListType(),
    },
    Table,
  );
  const list = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((_) => fn());

  const action = getInsertAction(
    TableSchema,
    new Map<string, any>([
      ["id", v1()],
      ["list", list],
      ["createdAt", new Date()],
      ["updatedAt", new Date()],
    ]),
  );
  const ent = await action.saveX();
  expect(ent.data.list).toStrictEqual(list);

  await tdb.drop("tables");
});
