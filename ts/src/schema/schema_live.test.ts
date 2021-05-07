import { LoggedOutViewer } from "../core/viewer";
import {
  StringType,
  TimeType,
  TimetzType,
  UUIDType,
  leftPad,
  DateType,
  TimestamptzType,
} from "../schema/field";
import { BaseEntSchema, Schema, Field } from "../schema";
import { User, SimpleAction } from "../testutils/builder";
import {
  table,
  TempDB,
  text,
  timestamp,
  timestamptz,
  time,
  timetz,
  uuid,
  date,
} from "../testutils/db/test_db";
import { v4 as uuidv4 } from "uuid";
import pg from "pg";
import { defaultTimestampParser } from "../core/db";
import { BaseEntSchemaWithTZ } from "./base_schema";
import { DBType } from "./schema";
import { AlwaysAllowPrivacyPolicy } from "../core/privacy";
import { ID, Ent, Viewer, Data } from "../core/base";
import * as fs from "fs";
import * as path from "path";

class UserSchema extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
  ];
  ent = User;
}

class UserWithTimezoneSchema extends BaseEntSchemaWithTZ {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
  ];
  ent = User;
}

class UserWithTimestampNoFormatSchema implements Schema {
  fields: Field[] = [
    UUIDType({
      name: "ID",
      primaryKey: true,
      defaultValueOnCreate: () => {
        return uuidv4();
      },
    }),
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
    // manual timestamps. no formatting that comes with TimestampType
    {
      name: "createdAt",
      type: {
        dbType: DBType.Timestamp,
      },
      defaultValueOnCreate: () => {
        return new Date();
      },
      logValue: (val) => val,
    },
    {
      name: "updatedAt",
      type: {
        dbType: DBType.Timestamp,
      },
      defaultValueOnCreate: () => {
        return new Date();
      },
      logValue: (val) => val,
    },
  ];
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
  tdb = new TempDB();

  await tdb.beforeAll();
});

afterAll(async () => {
  await tdb.afterAll();
});

afterEach(async () => {
  await tdb.drop("users");
});

describe("timestamp", () => {
  beforeEach(async () => {
    await createRegUsers();
  });

  test("standard", async () => {
    const date = new Date();
    const action = new SimpleAction(
      new LoggedOutViewer(),
      new UserSchema(),
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
    const action = new SimpleAction(
      new LoggedOutViewer(),
      new UserSchema(),
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
    const action = new SimpleAction(
      new LoggedOutViewer(),
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
    const action = new SimpleAction(
      new LoggedOutViewer(),
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
  const action = new SimpleAction(
    new LoggedOutViewer(),
    new UserWithTimezoneSchema(),
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
  privacyPolicy = AlwaysAllowPrivacyPolicy;

  constructor(public viewer: Viewer, id: ID, public data: Data) {
    this.id = id;
  }
}

class HoursSchema implements Schema {
  fields: Field[] = [
    // should be an enum but let's ignore that
    StringType({ name: "dayOfWeek" }),
    TimeType({ name: "open" }),
    TimeType({ name: "close" }),
  ];
  ent = Hours;
}

class HoursTZSchema implements Schema {
  fields: Field[] = [
    // should be an enum but let's ignore that
    StringType({ name: "dayOfWeek" }),
    TimetzType({ name: "open" }),
    TimetzType({ name: "close" }),
  ];
  ent = Hours;
}

const timeRegex = /^([01][0-9]):([0-5][0-9]):([0-5][0-9])(.[0-9]+)?$/;

describe("time", () => {
  beforeAll(async () => {
    await createTimeTable();
  });

  afterAll(async () => {
    await tdb.drop("hours");
  });

  async function createTimeTable() {
    await tdb.create(
      table("hours", text("day_of_week"), time("open"), time("close")),
    );
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
    const action = new SimpleAction(
      new LoggedOutViewer(),
      new HoursSchema(),
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
    const action = new SimpleAction(
      new LoggedOutViewer(),
      new HoursSchema(),
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

const dateOffset = (d: Date): string => {
  // for some reason this API is backwards
  const val = leftPad((d.getTimezoneOffset() / 60) * -1);
  if (val == "00") {
    return "+00";
  }
  return val;
};

describe("timetz", () => {
  beforeAll(async () => {
    await createTimeTable();
  });

  afterAll(async () => {
    await tdb.drop("hours");
  });

  async function createTimeTable() {
    await tdb.create(
      table("hours", text("day_of_week"), timetz("open"), timetz("close")),
    );
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
    const action = new SimpleAction(
      new LoggedOutViewer(),
      new HoursTZSchema(),
      new Map<string, any>([
        ["dayOfWeek", "sunday"],
        ["open", open],
        ["close", close],
      ]),
    );

    let offset = dateOffset(open);

    const hours = await action.saveX();
    expect(hours.data.open).toEqual(`08:00:00${offset}`);
    expect(hours.data.close).toEqual(`17:00:00${offset}`);
  });

  test("time format", async () => {
    const action = new SimpleAction(
      new LoggedOutViewer(),
      new HoursSchema(),
      new Map<string, any>([
        ["dayOfWeek", "sunday"],
        ["open", "8:00 AM"],
        ["close", "5:00 PM"],
      ]),
    );

    const d = new Date();
    let offset = dateOffset(d);

    const hours = await action.saveX();
    expect(hours.data.open).toEqual(`08:00:00${offset}`);
    expect(hours.data.close).toEqual(`17:00:00${offset}`);
  });
});

class Holiday implements Ent {
  id: ID;
  accountID: string;
  nodeType = "Holiday";
  privacyPolicy = AlwaysAllowPrivacyPolicy;

  constructor(public viewer: Viewer, id: ID, public data: Data) {
    this.id = id;
  }
}

class HolidaySchema implements Schema {
  fields: Field[] = [
    // should be an enum but let's ignore that
    StringType({ name: "label" }),
    DateType({ name: "date" }),
  ];
  ent = Holiday;
}

describe("date", () => {
  beforeAll(async () => {
    await createHolidaysTable();
  });

  afterAll(async () => {
    await tdb.drop("hours");
  });

  async function createHolidaysTable() {
    await tdb.create(table("holidays", text("label"), date("date")));
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
    const action = new SimpleAction(
      new LoggedOutViewer(),
      new HolidaySchema(),
      new Map<string, any>([
        ["label", "inaugaration"],
        ["date", getInaugauration()],
      ]),
    );

    const holiday = await action.saveX();

    expect(holiday.data.date).toEqual(expectedValue());
  });

  test("date format", async () => {
    const action = new SimpleAction(
      new LoggedOutViewer(),
      new HolidaySchema(),
      new Map<string, any>([
        ["label", "inaugaration"],
        ["date", "2021-01-20"],
      ]),
    );

    const holiday = await action.saveX();
    expect(holiday.data.date).toEqual(expectedValue());
  });
});

test("timestamptz copy", async () => {
  await createUsersWithTZ();

  const file = path.join(
    process.cwd(),
    Math.random()
      .toString(16)
      .substring(2),
  );

  const tzType = TimestamptzType({ name: "field" });
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
    const client = tdb.getDBClient();

    const query = `COPY users (${rows[0].join(",")}) FROM '${file}' CSV HEADER`;
    await client.query(query);

    const r = await client.query("SELECT COUNT(1) FROM users");
    expect(r.rowCount).toBe(1);
    const row = r.rows[0];
    expect(row.count).toBe("1");
  } catch (err) {
    fail(err);
  } finally {
    fs.rmSync(file, { force: true, recursive: true });
  }
});
