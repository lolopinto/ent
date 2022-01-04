import { Pool } from "pg";
import { v1 } from "uuid";
import { UUIDType, UUIDListType, StringType } from "./field";
import { DBType, PolymorphicOptions, Type, FieldOptions } from "./schema";
import { Field } from "./schema";
import { BaseEntSchema } from "./base_schema";
import { User, SimpleAction } from "../testutils/builder";
import { LoggedOutViewer } from "../core/viewer";
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

describe("fieldEdge list", () => {
  test("enforce checks", async () => {
    class ContactEmail extends User {}
    class ContactEmailSchema extends BaseEntSchema {
      fields: Field[] = [StringType({ name: "Email" })];
      ent = ContactEmail;
    }

    class Contact extends User {}
    class ContactShema extends BaseEntSchema {
      fields: Field[] = [
        UUIDListType({
          name: "emailIDs",
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
      ];
      ent = Contact;
    }

    const emailAction1 = new SimpleAction(
      new LoggedOutViewer(),
      new ContactEmailSchema(),
      new Map<string, any>([["Email", "foo@bar.com"]]),
    );
    const email1 = await emailAction1.saveX();
    expect(email1.data.email).toBe("foo@bar.com");
    const emailAction2 = new SimpleAction(
      new LoggedOutViewer(),
      new ContactEmailSchema(),
      new Map<string, any>([["Email", "foo2@bar.com"]]),
    );
    const email2 = await emailAction2.saveX();
    expect(email2.data.email).toBe("foo2@bar.com");

    const action = new SimpleAction(
      new LoggedOutViewer(),
      new ContactShema(),
      new Map<string, any>([["emailIDs", [email1.id, email2.id]]]),
    );

    const contact = await action.saveX();
    expect(contact.data.email_i_ds).toStrictEqual([email1.id, email2.id]);

    const action2 = new SimpleAction(
      new LoggedOutViewer(),
      new ContactShema(),
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
    class ContactEmailSchema extends BaseEntSchema {
      fields: Field[] = [StringType({ name: "Email" })];
      ent = ContactEmail;
    }

    class Contact extends User {}
    class ContactShema extends BaseEntSchema {
      fields: Field[] = [
        UUIDListType({
          name: "emailIDs",
          fieldEdge: {
            schema: "ContactEmail",
          },
        }),
      ];
      ent = Contact;
    }

    const emailAction1 = new SimpleAction(
      new LoggedOutViewer(),
      new ContactEmailSchema(),
      new Map<string, any>([["Email", "foo@bar.com"]]),
    );
    const email1 = await emailAction1.saveX();
    expect(email1.data.email).toBe("foo@bar.com");
    const emailAction2 = new SimpleAction(
      new LoggedOutViewer(),
      new ContactEmailSchema(),
      new Map<string, any>([["Email", "foo2@bar.com"]]),
    );
    const email2 = await emailAction2.saveX();
    expect(email2.data.email).toBe("foo2@bar.com");

    const fakeID = v1();
    const action = new SimpleAction(
      new LoggedOutViewer(),
      new ContactShema(),
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
