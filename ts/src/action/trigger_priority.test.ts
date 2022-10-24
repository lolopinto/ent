import { WriteOperation } from "../action";
import { Viewer } from "../core/base";
import { LoggedOutViewer } from "../core/viewer";
import { StringType } from "../schema/field";
import {
  User,
  SimpleAction,
  SimpleBuilder,
  EntBuilderSchema,
} from "../testutils/builder";
import { Pool } from "pg";
import { QueryRecorder } from "../testutils/db_mock";
import { Dialect } from "../core/db";
import { getSchemaTable, setupSqlite, Table } from "../testutils/db/temp_db";

jest.mock("pg");
QueryRecorder.mockPool(Pool);

afterEach(() => {
  QueryRecorder.clear();
});

describe("postgres", () => {
  commonTests();
});

const UserSchema = new EntBuilderSchema(User, {
  fields: {
    FirstName: StringType(),
    LastName: StringType(),
  },
});

describe("sqlite", () => {
  const getTables = () => {
    const tables: Table[] = [];
    [UserSchema].map((s) => tables.push(getSchemaTable(s, Dialect.SQLite)));
    return tables;
  };

  setupSqlite(`sqlite:///trigger-priority-test.db`, getTables);
  commonTests();
});

function getInsertUserAction(
  map: Map<string, any>,
  viewer: Viewer = new LoggedOutViewer(),
) {
  return new SimpleAction(viewer, UserSchema, map, WriteOperation.Insert, null);
}

function commonTests() {
  test("with one list depending on individual higher priority", async () => {
    const action = getInsertUserAction(
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
    );
    action.getTriggers = () => [
      {
        changeset: (builder: SimpleBuilder<User>) => {
          expect(builder.getStoredData("key1")).toBeUndefined();
          builder.storeData("key1", "called");
        },
      },
      [
        {
          changeset: (builder: SimpleBuilder<User>) => {
            expect(builder.getStoredData("key1")).toBe("called");
            builder.storeData("key2", "called");
          },
        },
      ],
    ];

    await action.saveX();
    expect(action.builder.getStoredData("key1")).toBe("called");
    expect(action.builder.getStoredData("key2")).toBe("called");
  });

  test("with one list depending on the other list", async () => {
    const action = getInsertUserAction(
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
    );
    action.getTriggers = () => [
      [
        {
          changeset: (builder: SimpleBuilder<User>) => {
            expect(builder.getStoredData("key1")).toBeUndefined();
            builder.storeData("key1", "called");
          },
        },
      ],
      [
        {
          changeset: (builder: SimpleBuilder<User>) => {
            expect(builder.getStoredData("key1")).toBe("called");
            builder.storeData("key2", "called");
          },
        },
      ],
    ];

    await action.saveX();
    expect(action.builder.getStoredData("key1")).toBe("called");
    expect(action.builder.getStoredData("key2")).toBe("called");
  });

  test("with one depending on prior list", async () => {
    const action = getInsertUserAction(
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
    );
    action.getTriggers = () => [
      [
        {
          changeset: (builder: SimpleBuilder<User>) => {
            expect(builder.getStoredData("key1")).toBeUndefined();
            builder.storeData("key1", "called");
          },
        },
      ],
      {
        changeset: (builder: SimpleBuilder<User>) => {
          expect(builder.getStoredData("key1")).toBe("called");
          builder.storeData("key2", "called");
        },
      },
    ];

    await action.saveX();
    expect(action.builder.getStoredData("key1")).toBe("called");
    expect(action.builder.getStoredData("key2")).toBe("called");
  });

  test("with multiple which depend on higher priority list", async () => {
    const action = getInsertUserAction(
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
    );
    action.getTriggers = () => [
      [
        {
          changeset: (builder: SimpleBuilder<User>) => {
            expect(builder.getStoredData("key")).toBeUndefined();
            builder.storeData("key1", "called");
          },
        },
      ],
      {
        changeset: (builder: SimpleBuilder<User>) => {
          expect(builder.getStoredData("key1")).toBe("called");
          builder.storeData("key2a", "called");
        },
      },
      {
        changeset: (builder: SimpleBuilder<User>) => {
          expect(builder.getStoredData("key1")).toBe("called");
          builder.storeData("key2b", "called");
        },
      },
    ];

    await action.saveX();
    expect(action.builder.getStoredData("key1")).toBe("called");
    expect(action.builder.getStoredData("key2a")).toBe("called");
    expect(action.builder.getStoredData("key2b")).toBe("called");
  });

  test("with multiple in list which depend on higher priority one in list", async () => {
    const action = getInsertUserAction(
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
    );
    action.getTriggers = () => [
      [
        {
          changeset: (builder: SimpleBuilder<User>) => {
            expect(builder.getStoredData("key")).toBeUndefined();
            builder.storeData("key1", "called");
          },
        },
      ],
      [
        {
          changeset: (builder: SimpleBuilder<User>) => {
            expect(builder.getStoredData("key1")).toBe("called");
            builder.storeData("key2a", "called");
          },
        },
        {
          changeset: (builder: SimpleBuilder<User>) => {
            expect(builder.getStoredData("key1")).toBe("called");
            builder.storeData("key2b", "called");
          },
        },
      ],
    ];

    await action.saveX();
    expect(action.builder.getStoredData("key1")).toBe("called");
    expect(action.builder.getStoredData("key2a")).toBe("called");
    expect(action.builder.getStoredData("key2b")).toBe("called");
  });

  test("with multiple in list which depend on higher priority one", async () => {
    const action = getInsertUserAction(
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
    );
    action.getTriggers = () => [
      {
        changeset: (builder: SimpleBuilder<User>) => {
          expect(builder.getStoredData("key")).toBeUndefined();
          builder.storeData("key1", "called");
        },
      },
      [
        {
          changeset: (builder: SimpleBuilder<User>) => {
            expect(builder.getStoredData("key1")).toBe("called");
            builder.storeData("key2a", "called");
          },
        },
        {
          changeset: (builder: SimpleBuilder<User>) => {
            expect(builder.getStoredData("key1")).toBe("called");
            builder.storeData("key2b", "called");
          },
        },
      ],
    ];

    await action.saveX();
    expect(action.builder.getStoredData("key1")).toBe("called");
    expect(action.builder.getStoredData("key2a")).toBe("called");
    expect(action.builder.getStoredData("key2b")).toBe("called");
  });

  test("combine all the things", async () => {
    const action = getInsertUserAction(
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
    );
    action.getTriggers = () => [
      [
        {
          changeset: (builder: SimpleBuilder<User>) => {
            expect(builder.getStoredData("key1")).toBeUndefined();
            expect(builder.getStoredData("key2")).toBeUndefined();
            builder.storeData("key1", "called");
          },
        },
      ],
      [
        {
          changeset: (builder: SimpleBuilder<User>) => {
            expect(builder.getStoredData("key1")).toBe("called");
            expect(builder.getStoredData("key2")).toBeUndefined();
            builder.storeData("key2", "called");
          },
        },
      ],
      [
        {
          changeset: (builder: SimpleBuilder<User>) => {
            expect(builder.getStoredData("key1")).toBe("called");
            expect(builder.getStoredData("key2")).toBe("called");
            builder.storeData("key3a", "called");
          },
        },
        {
          changeset: (builder: SimpleBuilder<User>) => {
            expect(builder.getStoredData("key1")).toBe("called");
            expect(builder.getStoredData("key2")).toBe("called");
            builder.storeData("key3b", "called");
          },
        },
      ],
      {
        changeset: (builder: SimpleBuilder<User>) => {
          expect(builder.getStoredData("key1")).toBe("called");
          expect(builder.getStoredData("key2")).toBe("called");
          expect(builder.getStoredData("key3a")).toBe("called");
          expect(builder.getStoredData("key3b")).toBe("called");
          builder.storeData("key4", "called");
        },
      },
    ];

    await action.saveX();
    expect(action.builder.getStoredData("key1")).toBe("called");
    expect(action.builder.getStoredData("key2")).toBe("called");
    expect(action.builder.getStoredData("key3a")).toBe("called");
    expect(action.builder.getStoredData("key3b")).toBe("called");
    expect(action.builder.getStoredData("key4")).toBe("called");
  });
}
