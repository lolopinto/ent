import { LoggedOutViewer, IDViewer } from "../core/viewer";
import { StringType, TimeType, UUIDType } from "../schema/field";
import { BaseEntSchema, Schema, Field } from "../schema";
import { User, SimpleBuilder } from "../testutils/builder";
import {
  table,
  TempDB,
  text,
  timestamp,
  timestamptz,
  uuid,
} from "../testutils/db/test_db";
import { v4 as uuidv4 } from "uuid";
import pg from "pg";
import { defaultTimestampParser } from "../core/db";
import { DBType } from "./schema";

class UserSchema extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
  ];
  ent = User;
}

class UserWithTimezoneSchema implements Schema {
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
    TimeType({
      name: "createdAt",
      defaultValueOnCreate: () => {
        return new Date();
      },
      withTimezone: true,
    }),
    TimeType({
      name: "updatedAt",
      defaultValueOnCreate: () => {
        return new Date();
      },
      withTimezone: true,
    }),
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
    // manual timestamps. no formatting that comes with TimeType
    {
      name: "createdAt",
      type: {
        dbType: DBType.Time,
      },
      defaultValueOnCreate: () => {
        return new Date();
      },
    },
    {
      name: "updatedAt",
      type: {
        dbType: DBType.Time,
      },
      defaultValueOnCreate: () => {
        return new Date();
      },
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
    const builder = new SimpleBuilder(
      new LoggedOutViewer(),
      new UserSchema(),
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
    );
    const user = await builder.saveX();
    const createdAt: Date = user.data.created_at;
    const updatedAt: Date = user.data.updated_at;

    // created at and updated at even though stored in utc with timestamp without timezone
    // when retrieved, we get a timestamp that's close to what we expect.
    expect(Math.abs(createdAt.getTime() - date.getTime())).toBeLessThan(10);
    expect(Math.abs(updatedAt.getTime() - date.getTime())).toBeLessThan(10);

    // console.log(date.toLocaleTimeString(), date.toUTCString(), date.getTime());
    // console.log(
    //   createdAt.toLocaleTimeString(),
    //   createdAt.toUTCString(),
    //   createdAt.getTime(),
    //   createdAt.getTimezoneOffset(),
    // );
    // console.log(
    //   updatedAt.toLocaleTimeString(),
    //   updatedAt.toUTCString(),
    //   updatedAt.getTime(),
    // );
    // console.log(
    //   createdAt.getTime() - date.getTime(),
    //   updatedAt.getTime() - date.getTime(),
    // );
  });

  test("no setTypeParser", async () => {
    const date = new Date();
    const builder = new SimpleBuilder(
      new LoggedOutViewer(),
      new UserSchema(),
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
    );

    // reset to default ts parser
    const prevParser = pg.types.getTypeParser(1114);
    pg.types.setTypeParser(1114, defaultTimestampParser);

    const user = await builder.saveX();
    const createdAt: Date = user.data.created_at;
    const updatedAt: Date = user.data.updated_at;

    // with default parser, value we get back is off
    expect(Math.abs(createdAt.getTime() - date.getTime())).toBeGreaterThan(
      date.getTimezoneOffset() * 60000,
    );
    expect(Math.abs(updatedAt.getTime() - date.getTime())).toBeGreaterThan(
      date.getTimezoneOffset() * 60000,
    );
    expectWithinTZ(createdAt, date);
    expectWithinTZ(updatedAt, date);

    // restore parser
    pg.types.setTypeParser(1114, prevParser);
  });

  function expectWithinTZ(date1: Date, date2: Date) {
    let diff = Math.abs(date1.getTime() - date2.getTime());
    let offset = date1.getTimezoneOffset() * 60000;
    expect(Math.abs(offset - diff)).toBeLessThan(10);
  }

  test("no toISO formattting", async () => {
    const date = new Date();
    const builder = new SimpleBuilder(
      new LoggedOutViewer(),
      new UserWithTimestampNoFormatSchema(),
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
    );
    const user = await builder.saveX();
    const createdAt: Date = user.data.created_at;
    const updatedAt: Date = user.data.updated_at;

    // difference btw date not in db and value stored is within tz differences
    expectWithinTZ(createdAt, date);
    expectWithinTZ(updatedAt, date);
  });

  test("neither toISO formatting nor new parser", async () => {
    const date = new Date();
    const builder = new SimpleBuilder(
      new LoggedOutViewer(),
      new UserWithTimestampNoFormatSchema(),
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
    );
    // reset to default ts parser
    const prevParser = pg.types.getTypeParser(1114);
    pg.types.setTypeParser(1114, defaultTimestampParser);

    const user = await builder.saveX();
    const createdAt: Date = user.data.created_at;
    const updatedAt: Date = user.data.updated_at;

    // this is fine but depends on db and node server being in sync
    // don't currently have a good way to test this so showing this in action
    expect(Math.abs(createdAt.getTime() - date.getTime())).toBeLessThan(10);
    expect(Math.abs(updatedAt.getTime() - date.getTime())).toBeLessThan(10);

    // restore parser
    pg.types.setTypeParser(1114, prevParser);
  });
});

test("timestamptz", async () => {
  await createUsersWithTZ();
  const date = new Date();
  const builder = new SimpleBuilder(
    new LoggedOutViewer(),
    new UserWithTimezoneSchema(),
    new Map([
      ["FirstName", "Jon"],
      ["LastName", "Snow"],
    ]),
  );

  const user = await builder.saveX();
  const createdAt: Date = user.data.created_at;
  const updatedAt: Date = user.data.updated_at;

  // stored with timezone. no formatting is done and no magic is done and we get what we want back
  expect(Math.abs(createdAt.getTime() - date.getTime())).toBeLessThan(10);
  expect(Math.abs(updatedAt.getTime() - date.getTime())).toBeLessThan(10);

  expect(date.getTimezoneOffset()).toBe(createdAt.getTimezoneOffset());
  expect(date.getTimezoneOffset()).toBe(updatedAt.getTimezoneOffset());
});
