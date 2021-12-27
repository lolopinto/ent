import { UUIDType, StringType } from "./field";
import { DBType, PolymorphicOptions, Type, FieldOptions } from "./schema";
import Schema, { Field } from "./schema";
import { BaseEntSchema } from "./base_schema";
import { User, SimpleAction } from "../testutils/builder";
import { LoggedOutViewer } from "../core/viewer";
import { Pool } from "pg";
import { QueryRecorder } from "../testutils/db_mock";
import { ObjectLoaderFactory } from "../core/loaders/object_loader";
jest.mock("pg");
QueryRecorder.mockPool(Pool);

test("polymorphic true", () => {
  doTest(true, {
    dbType: DBType.String,
  });
});

test("polymorphic true nullable true", () => {
  doTest(
    true,
    {
      dbType: DBType.String,
    },
    {
      nullable: true,
    },
  );
});

test("polymorphic object", () => {
  doTest(
    { types: ["User", "Post"] },
    {
      dbType: DBType.StringEnum,
      values: ["User", "Post"],
      type: "fooType",
      graphQLType: "fooType",
      enumMap: undefined,
    },
  );
});

test("polymorphic object, nullable true", () => {
  doTest(
    { types: ["User", "Post"] },
    {
      dbType: DBType.StringEnum,
      values: ["User", "Post"],
      type: "fooType",
      graphQLType: "fooType",
      enumMap: undefined,
    },
    {
      nullable: true,
    },
  );
});

function doTest(
  polymorphic: boolean | PolymorphicOptions,
  expDerivedType: Type,
  opts?: Partial<FieldOptions>,
) {
  const f = UUIDType({ name: "fooID", polymorphic: polymorphic, ...opts });
  expect(f.derivedFields?.length).toBe(1);
  const derived = f.derivedFields![0];
  expect(derived.type).toStrictEqual(expDerivedType);
  expect(derived.nullable).toBe(opts?.nullable);
}

describe("fieldEdge no inverseEdge", () => {
  test("no checks", async () => {
    class UserSchema extends BaseEntSchema {
      fields: Field[] = [StringType({ name: "Name" })];
      ent = User;
    }

    class Account extends User {}
    class AccountSchema extends BaseEntSchema {
      fields: Field[] = [
        UUIDType({ name: "userID", fieldEdge: { schema: "User" } }),
      ];
      ent = Account;
    }

    const userAction = new SimpleAction(
      new LoggedOutViewer(),
      new UserSchema(),
      new Map<string, any>([["Name", "Jon Snow"]]),
    );
    const action = new SimpleAction(
      new LoggedOutViewer(),
      new AccountSchema(),
      new Map<string, any>([["userID", userAction.builder]]),
    );
    action.triggers = [
      {
        changeset() {
          return userAction.changeset();
        },
      },
    ];

    const account = await action.saveX();
    const user = await userAction.editedEntX();
    expect(user.data.name).toBe("Jon Snow");
    expect(account.data.user_id).toBe(user.id);
  });

  test("enforce checks with builder", async () => {
    class UserSchema extends BaseEntSchema {
      fields: Field[] = [StringType({ name: "Name" })];
      ent = User;
    }

    class Account extends User {}
    class AccountSchema extends BaseEntSchema {
      fields: Field[] = [
        UUIDType({
          name: "userID",
          fieldEdge: {
            schema: "User",
            enforceSchema: true,
            getLoaderOptions: () => {
              return {
                tableName: "users",
                fields: ["id"],
                ent: User,
                loaderFactory: new ObjectLoaderFactory({
                  tableName: "users",
                  fields: ["id"],
                  key: "id",
                }),
              };
            },
          },
        }),
      ];
      ent = Account;
    }

    const userAction = new SimpleAction(
      new LoggedOutViewer(),
      new UserSchema(),
      new Map<string, any>([["Name", "Jon Snow"]]),
    );
    const action = new SimpleAction(
      new LoggedOutViewer(),
      new AccountSchema(),
      new Map<string, any>([["userID", userAction.builder]]),
    );
    action.triggers = [
      {
        changeset() {
          return userAction.changeset();
        },
      },
    ];

    const account = await action.saveX();
    const user = await userAction.editedEntX();
    expect(user.data.name).toBe("Jon Snow");
    expect(account.data.user_id).toBe(user.id);
  });

  test("enforce checks with builder. invalid builder", async () => {
    class UserSchema extends BaseEntSchema {
      fields: Field[] = [StringType({ name: "Name" })];
      ent = User;
    }

    class Account extends User {}
    class AccountSchema extends BaseEntSchema {
      fields: Field[] = [
        UUIDType({
          name: "userID",
          fieldEdge: {
            schema: "User",
            enforceSchema: true,
            getLoaderOptions: () => {
              return {
                tableName: "users",
                fields: ["id"],
                ent: User,
                loaderFactory: new ObjectLoaderFactory({
                  tableName: "users",
                  fields: ["id"],
                  key: "id",
                }),
              };
            },
          },
        }),
      ];
      ent = Account;
    }

    const userAction = new SimpleAction(
      new LoggedOutViewer(),
      new UserSchema(),
      new Map<string, any>([["Name", "Jon Snow"]]),
    );
    const user = await userAction.saveX();
    expect(user.data.name).toBe("Jon Snow");

    // action2 valid
    const action2 = new SimpleAction(
      new LoggedOutViewer(),
      new AccountSchema(),
      new Map<string, any>([["userID", user.id]]),
    );

    // action3 invalid
    const action3 = new SimpleAction(
      new LoggedOutViewer(),
      new AccountSchema(),
      new Map<string, any>([["userID", action2]]),
    );

    try {
      await action3.saveX();
      throw new Error(`should have thrown`);
    } catch (err) {
      expect((err as Error).message).toMatch(
        /invalid field userID with value (.+)/,
      );
    }
  });

  test("enforce checks no builder", async () => {
    class UserSchema extends BaseEntSchema {
      fields: Field[] = [StringType({ name: "Name" })];
      ent = User;
    }

    class Account extends User {}
    class AccountSchema extends BaseEntSchema {
      fields: Field[] = [
        UUIDType({
          name: "userID",
          fieldEdge: {
            schema: "User",
            enforceSchema: true,
            getLoaderOptions: () => {
              return {
                tableName: "users",
                fields: ["id"],
                ent: User,
                loaderFactory: new ObjectLoaderFactory({
                  tableName: "users",
                  fields: ["id"],
                  key: "id",
                }),
              };
            },
          },
        }),
      ];
      ent = Account;
    }

    const userAction = new SimpleAction(
      new LoggedOutViewer(),
      new UserSchema(),
      new Map<string, any>([["Name", "Jon Snow"]]),
    );
    const user = await userAction.saveX();
    expect(user.data.name).toBe("Jon Snow");

    const action = new SimpleAction(
      new LoggedOutViewer(),
      new AccountSchema(),
      new Map<string, any>([["userID", user.id]]),
    );

    const account = await action.saveX();
    expect(account.data.user_id).toBe(user.id);

    const action2 = new SimpleAction(
      new LoggedOutViewer(),
      new AccountSchema(),
      new Map<string, any>([["userID", account.id]]),
    );

    try {
      await action2.saveX();
      throw new Error(`should have thrown`);
    } catch (err) {
      expect((err as Error).message).toMatch(
        /invalid field userID with value (.+)/,
      );
    }
  });
});
