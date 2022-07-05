import { WriteOperation } from "../action";
import { Viewer } from "../core/base";
import { LoggedOutViewer } from "../core/viewer";
import { StringType } from "../schema/field";
import { BaseEntSchema } from "../schema";
import { User, SimpleAction, SimpleBuilder } from "../testutils/builder";
import { Pool } from "pg";
import { QueryRecorder } from "../testutils/db_mock";
import { Dialect } from "../core/db";
import { getSchemaTable, setupSqlite, Table } from "../testutils/db/test_db";
import { FieldMap } from "../schema";

jest.mock("pg");
QueryRecorder.mockPool(Pool);

afterEach(() => {
  QueryRecorder.clear();
});

describe("postgres", () => {
  commonTests();
});

describe("sqlite", () => {
  const getTables = () => {
    const tables: Table[] = [];
    [new UserSchema()].map((s) =>
      tables.push(getSchemaTable(s, Dialect.SQLite)),
    );
    return tables;
  };

  setupSqlite(`sqlite:///trigger-priority-test.db`, getTables);
  commonTests();
});

class UserSchema extends BaseEntSchema {
  fields: FieldMap = {
    FirstName: StringType(),
    LastName: StringType(),
  };
  ent = User;
}

function getInsertUserAction(
  map: Map<string, any>,
  viewer: Viewer = new LoggedOutViewer(),
) {
  return new SimpleAction(
    viewer,
    new UserSchema(),
    map,
    WriteOperation.Insert,
    null,
  );
}

function commonTests() {
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
            const val = builder.getStoredData("key");
            expect(val).toBeUndefined();
            builder.storeData("key", "priority-1");
          },
        },
      ],
      [
        {
          changeset: (builder: SimpleBuilder<User>) => {
            const val = builder.getStoredData("key");
            expect(val).toBe("priority-1");
          },
        },
      ],
    ];

    await action.saveX();
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
            const val = builder.getStoredData("key");
            expect(val).toBeUndefined();
            builder.storeData("key", "priority-1");
          },
        },
      ],
      {
        changeset: (builder: SimpleBuilder<User>) => {
          const val = builder.getStoredData("key");
          expect(val).toBe("priority-1");
        },
      },
    ];

    await action.saveX();
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
            const val = builder.getStoredData("key");
            expect(val).toBeUndefined();
            builder.storeData("key", "priority-1");
          },
        },
      ],
      {
        changeset: (builder: SimpleBuilder<User>) => {
          const val = builder.getStoredData("key");
          expect(val).toBe("priority-1");
        },
      },
      {
        changeset: (builder: SimpleBuilder<User>) => {
          const val = builder.getStoredData("key");
          expect(val).toBe("priority-1");
        },
      },
    ];

    await action.saveX();
  });

  test("with multiple in list which depend on higher priority one", async () => {
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
            const val = builder.getStoredData("key");
            expect(val).toBeUndefined();
            builder.storeData("key", "priority-1");
          },
        },
      ],
      [
        {
          changeset: (builder: SimpleBuilder<User>) => {
            const val = builder.getStoredData("key");
            expect(val).toBe("priority-1");
          },
        },
        {
          changeset: (builder: SimpleBuilder<User>) => {
            const val = builder.getStoredData("key");
            expect(val).toBe("priority-1");
          },
        },
      ],
    ];

    await action.saveX();
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
            const val = builder.getStoredData("key");
            const val2 = builder.getStoredData("key2");
            expect(val).toBeUndefined();
            expect(val2).toBeUndefined();
            builder.storeData("key", "priority-1");
          },
        },
      ],
      [
        {
          changeset: (builder: SimpleBuilder<User>) => {
            const val = builder.getStoredData("key");
            const val2 = builder.getStoredData("key2");
            expect(val).toBe("priority-1");
            expect(val2).toBeUndefined();
            builder.storeData("key2", "priority-2");
          },
        },
      ],
      [
        {
          changeset: (builder: SimpleBuilder<User>) => {
            const val = builder.getStoredData("key");
            const val2 = builder.getStoredData("key2");
            expect(val).toBe("priority-1");
            expect(val2).toBe("priority-2");
            builder.storeData("key3a", "priority-3a");
          },
        },
        {
          changeset: (builder: SimpleBuilder<User>) => {
            const val = builder.getStoredData("key");
            const val2 = builder.getStoredData("key2");
            expect(val).toBe("priority-1");
            expect(val2).toBe("priority-2");
            builder.storeData("key3b", "priority-3b");
          },
        },
      ],
      {
        changeset: (builder: SimpleBuilder<User>) => {
          const val = builder.getStoredData("key");
          const val2 = builder.getStoredData("key2");
          const val3a = builder.getStoredData("key3a");
          const val3b = builder.getStoredData("key3b");

          expect(val).toBe("priority-1");
          expect(val2).toBe("priority-2");
          expect(val3a).toBe("priority-3a");
          expect(val3b).toBe("priority-3b");
        },
      },
    ];

    await action.saveX();
  });
}
