import { Pool } from "pg";
import { v1 } from "uuid";
import { UUIDType, UUIDListType, StringType } from "./field";
import { DBType, PolymorphicOptions, Type, FieldOptions } from "./schema";
import {
  User,
  SimpleAction,
  getBuilderSchemaFromFields,
  BuilderSchema,
} from "../testutils/builder";
import { LoggedOutViewer } from "../core/viewer";
import { QueryRecorder } from "../testutils/db_mock";
import { ObjectLoaderFactory } from "../core/loaders/object_loader";
import { Ent } from "../core/base";
import { WriteOperation } from "../action";

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
      type: undefined,
      graphQLType: undefined,
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
      type: undefined,
      graphQLType: undefined,
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
  const f = UUIDType({ polymorphic: polymorphic, ...opts });
  let lastKey = "";
  const derivedFields = f.getDerivedFields("fooID");
  const count = function () {
    let ct = 0;
    for (const k in derivedFields) {
      ct++;
      lastKey = k;
    }
    return ct;
  };
  expect(count()).toBe(1);
  const derived = derivedFields![lastKey];
  expect(derived.type).toStrictEqual(expDerivedType);
  expect(derived.nullable).toBe(opts?.nullable);
}

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

describe("fieldEdge no inverseEdge", () => {
  test("no checks", async () => {
    const UserSchema = getBuilderSchemaFromFields(
      {
        Name: StringType(),
      },
      User,
    );

    class Account extends User {}
    const AccountSchema = getBuilderSchemaFromFields(
      {
        userID: UUIDType({ fieldEdge: { schema: "User" } }),
      },
      Account,
    );

    const userAction = getInsertAction(
      UserSchema,
      new Map<string, any>([["Name", "Jon Snow"]]),
    );
    const action = getInsertAction(
      AccountSchema,
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
    const UserSchema = getBuilderSchemaFromFields(
      {
        Name: StringType(),
      },
      User,
    );

    class Account extends User {}
    const AccountSchema = getBuilderSchemaFromFields(
      {
        userID: UUIDType({
          fieldEdge: {
            schema: "User",
            enforceSchema: true,
            getLoaderInfoFromSchema: () => {
              return {
                tableName: "users",
                fields: ["id"],
                nodeType: "user",
                loaderFactory: new ObjectLoaderFactory({
                  tableName: "users",
                  fields: ["id"],
                  key: "id",
                }),
              };
            },
          },
        }),
      },
      Account,
    );

    const userAction = getInsertAction(
      UserSchema,
      new Map<string, any>([["Name", "Jon Snow"]]),
    );
    const action = getInsertAction(
      AccountSchema,
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
    const UserSchema = getBuilderSchemaFromFields(
      {
        Name: StringType(),
      },
      User,
    );

    class Account extends User {}
    const AccountSchema = getBuilderSchemaFromFields(
      {
        userID: UUIDType({
          fieldEdge: {
            schema: "User",
            enforceSchema: true,
            getLoaderInfoFromSchema: () => {
              return {
                tableName: "users",
                fields: ["id"],
                nodeType: "user",
                loaderFactory: new ObjectLoaderFactory({
                  tableName: "users",
                  fields: ["id"],
                  key: "id",
                }),
              };
            },
          },
        }),
      },
      Account,
    );

    const userAction = getInsertAction(
      UserSchema,
      new Map<string, any>([["Name", "Jon Snow"]]),
    );
    const user = await userAction.saveX();
    expect(user.data.name).toBe("Jon Snow");

    // action2 valid
    const action2 = getInsertAction(
      AccountSchema,
      new Map<string, any>([["userID", user.id]]),
    );

    // action3 invalid
    const action3 = getInsertAction(
      AccountSchema,
      new Map<string, any>([["userID", action2.builder]]),
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
    const UserSchema = getBuilderSchemaFromFields(
      {
        Name: StringType(),
      },
      User,
    );

    class Account extends User {}
    const AccountSchema = getBuilderSchemaFromFields(
      {
        userID: UUIDType({
          fieldEdge: {
            schema: "User",
            enforceSchema: true,
            getLoaderInfoFromSchema: () => {
              return {
                tableName: "users",
                fields: ["id"],
                nodeType: "user",
                loaderFactory: new ObjectLoaderFactory({
                  tableName: "users",
                  fields: ["id"],
                  key: "id",
                }),
              };
            },
          },
        }),
      },
      Account,
    );

    const userAction = getInsertAction(
      UserSchema,
      new Map<string, any>([["Name", "Jon Snow"]]),
    );
    const user = await userAction.saveX();
    expect(user.data.name).toBe("Jon Snow");

    const action = getInsertAction(
      AccountSchema,
      new Map<string, any>([["userID", user.id]]),
    );

    const account = await action.saveX();
    expect(account.data.user_id).toBe(user.id);

    const action2 = getInsertAction(
      AccountSchema,
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

describe("fieldEdge list", () => {
  test("enforce checks", async () => {
    class ContactEmail extends User {}
    const ContactEmailSchema = getBuilderSchemaFromFields(
      {
        Email: StringType(),
      },
      ContactEmail,
    );

    class Contact extends User {}
    const ContactShema = getBuilderSchemaFromFields(
      {
        emailIDs: UUIDListType({
          fieldEdge: {
            schema: "ContactEmail",
            enforceSchema: true,
            getLoaderInfoFromSchema: () => {
              return {
                tableName: "contact_emails",
                fields: ["id"],
                nodeType: "user",
                loaderFactory: new ObjectLoaderFactory({
                  tableName: "contact_emails",
                  fields: ["id"],
                  key: "id",
                }),
              };
            },
          },
        }),
      },
      Contact,
    );

    const emailAction1 = getInsertAction(
      ContactEmailSchema,
      new Map<string, any>([["Email", "foo@bar.com"]]),
    );
    const email1 = await emailAction1.saveX();
    expect(email1.data.email).toBe("foo@bar.com");
    const emailAction2 = getInsertAction(
      ContactEmailSchema,
      new Map<string, any>([["Email", "foo2@bar.com"]]),
    );
    const email2 = await emailAction2.saveX();
    expect(email2.data.email).toBe("foo2@bar.com");

    const action = getInsertAction(
      ContactShema,
      new Map<string, any>([["emailIDs", [email1.id, email2.id]]]),
    );

    const contact = await action.saveX();
    expect(contact.data.email_i_ds).toStrictEqual([email1.id, email2.id]);

    const action2 = getInsertAction(
      ContactShema,
      new Map<string, any>([["emailIDs", [email1.id, v1()]]]),
    );

    try {
      await action2.saveX();
      throw new Error(`should have thrown`);
    } catch (err) {
      expect((err as Error).message).toMatch(
        /invalid field emailIDs with value (.+)/,
      );
    }
  });

  test("don't enforce checks", async () => {
    class ContactEmail extends User {}
    const ContactEmailSchema = getBuilderSchemaFromFields(
      {
        Email: StringType(),
      },
      ContactEmail,
    );

    class Contact extends User {}
    const ContactShema = getBuilderSchemaFromFields(
      {
        emailIDs: UUIDListType({
          fieldEdge: {
            schema: "ContactEmail",
          },
        }),
      },
      Contact,
    );

    const emailAction1 = getInsertAction(
      ContactEmailSchema,
      new Map<string, any>([["Email", "foo@bar.com"]]),
    );
    const email1 = await emailAction1.saveX();
    expect(email1.data.email).toBe("foo@bar.com");
    const emailAction2 = getInsertAction(
      ContactEmailSchema,
      new Map<string, any>([["Email", "foo2@bar.com"]]),
    );
    const email2 = await emailAction2.saveX();
    expect(email2.data.email).toBe("foo2@bar.com");

    const fakeID = v1();
    const action = getInsertAction(
      ContactShema,
      new Map<string, any>([["emailIDs", [email1.id, email2.id, fakeID]]]),
    );

    const contact = await action.saveX();
    expect(contact.data.email_i_ds).toStrictEqual([
      email1.id,
      email2.id,
      fakeID,
    ]);
  });
});
