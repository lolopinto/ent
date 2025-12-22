import { v1, validate } from "uuid";
import {
  UUIDType,
  UUIDListType,
  StringType,
  PolymorphicStringField,
} from "./field.js";
import { DBType, PolymorphicOptions, Type, FieldOptions } from "./schema.js";
import {
  User,
  SimpleAction,
  getBuilderSchemaFromFields,
  BuilderSchema,
} from "../testutils/builder.js";
import { LoggedOutViewer } from "../core/viewer.js";
import { ObjectLoaderFactory } from "../core/loaders/object_loader.js";
import { Ent } from "../core/base.js";
import { WriteOperation } from "../action/index.js";
import { doSQLiteTestFromSchemas } from "../testutils/db/temp_db.js";
import { convertList } from "../core/convert.js";

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
      dbType: DBType.String,
    },
    {
      types: ["User", "Post"],
    },
  );
});

test("polymorphic object, nullable true", () => {
  doTest(
    { types: ["User", "Post"] },
    {
      dbType: DBType.String,
    },
    {
      nullable: true,
      types: ["User", "Post"],
    },
  );
});

test("polymorphic object. with types, serverDefault", () => {
  doTest(
    { types: ["User", "Post"], serverDefault: "hello" },
    {
      dbType: DBType.String,
    },
    {
      nullable: true,
      types: ["User", "Post"],
      serverDefault: "hello",
    },
  );
});

test("polymorphic object.  serverDefault", () => {
  doTest(
    { serverDefault: "hello" },
    {
      dbType: DBType.String,
    },
    {
      serverDefault: "hello",
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
  expect(derived).toBeInstanceOf(PolymorphicStringField);
  expect(derived.type).toStrictEqual(expDerivedType);
  expect(derived.nullable).toBe(opts?.nullable);
  expect(derived.serverDefault).toBe(opts?.serverDefault);
  expect(derived.types).toStrictEqual(opts?.types);
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

function getEditAction<T extends Ent>(
  schema: BuilderSchema<T>,
  map: Map<string, any>,
  ent: T,
) {
  return new SimpleAction(
    new LoggedOutViewer(),
    schema,
    map,
    WriteOperation.Edit,
    ent,
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

    await doSQLiteTestFromSchemas([UserSchema, AccountSchema], async () => {
      const action = getInsertAction(
        AccountSchema,
        new Map<string, any>([["userID", userAction.builder]]),
      );
      action.getTriggers = () => [
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

    await doSQLiteTestFromSchemas([UserSchema, AccountSchema], async () => {
      const userAction = getInsertAction(
        UserSchema,
        new Map<string, any>([["Name", "Jon Snow"]]),
      );
      const action = getInsertAction(
        AccountSchema,
        new Map<string, any>([["userID", userAction.builder]]),
      );
      action.getTriggers = () => [
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

    await doSQLiteTestFromSchemas([UserSchema, AccountSchema], async () => {
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

    await doSQLiteTestFromSchemas([UserSchema, AccountSchema], async () => {
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
});

describe("fieldEdge list", () => {
  test("enforce checks", async () => {
    class ContactEmail extends User {}
    const ContactEmailSchema = getBuilderSchemaFromFields(
      {
        email: StringType(),
      },
      ContactEmail,
    );

    class Contact extends User {}
    const ContactSchema = getBuilderSchemaFromFields(
      {
        email_ids: UUIDListType({
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

    await doSQLiteTestFromSchemas(
      [ContactEmailSchema, ContactSchema],
      async () => {
        const emailAction1 = getInsertAction(
          ContactEmailSchema,
          new Map<string, any>([["email", "foo@bar.com"]]),
        );
        const email1 = await emailAction1.saveX();
        expect(email1.data.email).toBe("foo@bar.com");
        const emailAction2 = getInsertAction(
          ContactEmailSchema,
          new Map<string, any>([["email", "foo2@bar.com"]]),
        );
        const email2 = await emailAction2.saveX();
        expect(email2.data.email).toBe("foo2@bar.com");

        const action = getInsertAction(
          ContactSchema,
          new Map<string, any>([["email_ids", [email1.id, email2.id]]]),
        );

        const contact = await action.saveX();
        expect(convertList(contact.data.email_ids)).toStrictEqual([
          email1.id,
          email2.id,
        ]);

        const action2 = getInsertAction(
          ContactSchema,
          new Map<string, any>([["email_ids", [email1.id, v1()]]]),
        );

        try {
          await action2.saveX();
          throw new Error(`should have thrown`);
        } catch (err) {
          expect((err as Error).message).toMatch(
            /invalid field email_ids with value (.+)/,
          );
        }
      },
    );
  });

  test("don't enforce checks", async () => {
    class ContactEmail extends User {}
    const ContactEmailSchema = getBuilderSchemaFromFields(
      {
        email: StringType(),
      },
      ContactEmail,
    );

    class Contact extends User {}
    const ContactSchema = getBuilderSchemaFromFields(
      {
        email_ids: UUIDListType({
          fieldEdge: {
            schema: "ContactEmail",
          },
        }),
      },
      Contact,
    );

    await doSQLiteTestFromSchemas(
      [ContactEmailSchema, ContactSchema],
      async () => {
        const emailAction1 = getInsertAction(
          ContactEmailSchema,
          new Map<string, any>([["email", "foo@bar.com"]]),
        );
        const email1 = await emailAction1.saveX();
        expect(email1.data.email).toBe("foo@bar.com");
        const emailAction2 = getInsertAction(
          ContactEmailSchema,
          new Map<string, any>([["email", "foo2@bar.com"]]),
        );
        const email2 = await emailAction2.saveX();
        expect(email2.data.email).toBe("foo2@bar.com");

        const fakeID = v1();
        const action = getInsertAction(
          ContactSchema,
          new Map<string, any>([["email_ids", [email1.id, email2.id, fakeID]]]),
        );

        const contact = await action.saveX();
        expect(convertList(contact.data.email_ids)).toStrictEqual([
          email1.id,
          email2.id,
          fakeID,
        ]);
      },
    );
  });
});

test("invalid uuid", async () => {
  class Account extends User {}
  const AccountSchema = getBuilderSchemaFromFields(
    {
      fake_id: UUIDType(),
    },
    Account,
  );

  await doSQLiteTestFromSchemas([AccountSchema], async () => {
    const accountAction = getInsertAction(
      AccountSchema,
      new Map<string, any>([["fake_id", "Jon Snow"]]),
    );

    try {
      await accountAction.saveX();
      throw new Error(`should have thrown`);
    } catch (e) {
      expect((e as Error).message).toBe(
        "invalid field fake_id with value Jon Snow",
      );
    }
  });
});

test("builder valid uuid", async () => {
  const UserSchema = getBuilderSchemaFromFields(
    {
      Name: StringType(),
    },
    User,
  );
  class Account extends User {}
  const AccountSchema = getBuilderSchemaFromFields(
    {
      fake_id: UUIDType(),
    },
    Account,
  );

  await doSQLiteTestFromSchemas([UserSchema, AccountSchema], async () => {
    const userAction = getInsertAction(
      UserSchema,
      new Map([["Name", "Jon Snow"]]),
    );
    const accountAction = getInsertAction(
      AccountSchema,
      new Map([["fake_id", userAction.builder]]),
    );
    accountAction.getTriggers = () => [
      {
        changeset() {
          return userAction.changeset();
        },
      },
    ];

    await accountAction.saveX();
  });
});

describe("saving polymorphic", () => {
  test("polymorphic true, nullable true, type not set set on insert", async () => {
    class Contact extends User {}
    const ContactSchema = getBuilderSchemaFromFields(
      {
        foo_id: UUIDType({
          polymorphic: true,
          nullable: true,
        }),
      },
      Contact,
    );

    await doSQLiteTestFromSchemas([ContactSchema], async () => {
      const action = getInsertAction(
        ContactSchema,
        new Map<string, any>([["foo_id", v1()]]),
      );
      try {
        await action.saveX();
        throw new Error("should throw");
      } catch (err) {
        expect((err as Error).message).toBe(
          `field foo_type set to undefined when it can't be nullable`,
        );
      }
    });
  });

  test("polymorphic true, nullable true, type not set on update", async () => {
    class Contact extends User {}
    const ContactSchema = getBuilderSchemaFromFields(
      {
        foo_id: UUIDType({
          polymorphic: true,
          nullable: true,
        }),
      },
      Contact,
    );

    await doSQLiteTestFromSchemas([ContactSchema], async () => {
      const action = getInsertAction(
        ContactSchema,
        new Map<string, any>([
          ["foo_id", v1()],
          ["foo_type", "hello"],
        ]),
      );
      const ent1 = await action.saveX();
      expect(validate(ent1.data.foo_id)).toBe(true);
      expect(ent1.data.foo_type).toBe("hello");

      const action2 = getEditAction(
        ContactSchema,
        new Map<string, any>([["foo_id", v1()]]),
        ent1,
      );
      const ent2 = await action2.saveX();
      expect(ent2.data.foo_type).toBe("hello");
      expect(validate(ent2.data.foo_id)).toBe(true);

      expect(ent1.data.foo_id).not.toBe(ent2.data.foo_id);
    });
  });

  test("polymorphic true, nullable true, only type set to null", async () => {
    class Contact extends User {}
    const ContactSchema = getBuilderSchemaFromFields(
      {
        foo_id: UUIDType({
          polymorphic: true,
          nullable: true,
        }),
      },
      Contact,
    );

    await doSQLiteTestFromSchemas([ContactSchema], async () => {
      const action = getInsertAction(
        ContactSchema,
        new Map<string, any>([
          ["foo_id", v1()],
          ["foo_type", null],
        ]),
      );
      try {
        await action.saveX();
        throw new Error("should throw");
      } catch (err) {
        expect((err as Error).message).toBe(
          `field foo_type set to null when it can't be nullable`,
        );
      }
    });
  });

  test("polymorphic true, nullable true, both set to null on create", async () => {
    class Contact extends User {}
    const ContactSchema = getBuilderSchemaFromFields(
      {
        foo_id: UUIDType({
          polymorphic: true,
          nullable: true,
        }),
      },
      Contact,
    );

    await doSQLiteTestFromSchemas([ContactSchema], async () => {
      const action = getInsertAction(
        ContactSchema,
        new Map<string, any>([
          ["foo_id", null],
          ["foo_type", null],
        ]),
      );
      const ent = await action.saveX();
      expect(ent.data.foo_id).toBe(null);
      expect(ent.data.foo_type).toBe(null);
    });
  });

  test("polymorphic true, nullable true, both not set on create", async () => {
    class Contact extends User {}
    const ContactSchema = getBuilderSchemaFromFields(
      {
        foo_id: UUIDType({
          polymorphic: true,
          nullable: true,
        }),
      },
      Contact,
    );

    await doSQLiteTestFromSchemas([ContactSchema], async () => {
      const action = getInsertAction(ContactSchema, new Map<string, any>([]));
      const ent = await action.saveX();
      expect(ent.data.foo_id).toBe(null);
      expect(ent.data.foo_type).toBe(null);
    });
  });

  test("polymorphic true, nullable true, type valid", async () => {
    class Contact extends User {}
    const ContactSchema = getBuilderSchemaFromFields(
      {
        foo_id: UUIDType({
          polymorphic: true,
          nullable: true,
        }),
      },
      Contact,
    );

    await doSQLiteTestFromSchemas([ContactSchema], async () => {
      const action = getInsertAction(
        ContactSchema,
        new Map<string, any>([
          ["foo_id", v1()],
          ["foo_type", "hello"],
        ]),
      );
      const ent = await action.saveX();
      expect(validate(ent.data.foo_id)).toBe(true);
      expect(ent.data.foo_type).toBe("hello");
    });
  });

  test("polymorphic true, nullable true, both changed to null on edit", async () => {
    class Contact extends User {}
    const ContactSchema = getBuilderSchemaFromFields(
      {
        foo_id: UUIDType({
          polymorphic: true,
          nullable: true,
        }),
      },
      Contact,
    );

    await doSQLiteTestFromSchemas([ContactSchema], async () => {
      const action = getInsertAction(
        ContactSchema,
        new Map<string, any>([
          ["foo_id", v1()],
          ["foo_type", "hello"],
        ]),
      );
      const ent = await action.saveX();
      expect(validate(ent.data.foo_id)).toBe(true);
      expect(ent.data.foo_type).toBe("hello");

      const action2 = getEditAction(
        ContactSchema,
        new Map<string, any>([
          ["foo_id", null],
          ["foo_type", null],
        ]),
        ent,
      );

      const ent2 = await action2.saveX();
      expect(ent2.data.foo_id).toBe(null);
      expect(ent2.data.foo_type).toBe(null);
    });
  });

  test("polymorphic true, nullable true, id changed to null on edit", async () => {
    class Contact extends User {}
    const ContactSchema = getBuilderSchemaFromFields(
      {
        foo_id: UUIDType({
          polymorphic: true,
          nullable: true,
        }),
      },
      Contact,
    );

    await doSQLiteTestFromSchemas([ContactSchema], async () => {
      const action = getInsertAction(
        ContactSchema,
        new Map<string, any>([
          ["foo_id", v1()],
          ["foo_type", "hello"],
        ]),
      );
      const ent = await action.saveX();
      expect(validate(ent.data.foo_id)).toBe(true);
      expect(ent.data.foo_type).toBe("hello");

      const action2 = getEditAction(
        ContactSchema,
        new Map<string, any>([["foo_id", null]]),
        ent,
      );

      const ent2 = await action2.saveX();
      expect(ent2.data.foo_id).toBe(null);
      // sadly ok since we don't check id's value...
      expect(ent2.data.foo_type).toBe("hello");
    });
  });

  test("polymorphic true, nullable true, type changed to null on edit", async () => {
    class Contact extends User {}
    const ContactSchema = getBuilderSchemaFromFields(
      {
        foo_id: UUIDType({
          polymorphic: true,
          nullable: true,
        }),
      },
      Contact,
    );

    await doSQLiteTestFromSchemas([ContactSchema], async () => {
      const action = getInsertAction(
        ContactSchema,
        new Map<string, any>([
          ["foo_id", v1()],
          ["foo_type", "hello"],
        ]),
      );
      const ent = await action.saveX();
      expect(validate(ent.data.foo_id)).toBe(true);
      expect(ent.data.foo_type).toBe("hello");

      const action2 = getEditAction(
        ContactSchema,
        new Map<string, any>([["foo_type", null]]),
        ent,
      );

      try {
        await action2.saveX();
        throw new Error("should throw");
      } catch (err) {
        // can't change this on its own. have to change with foo_id
        expect((err as Error).message).toBe(
          `field foo_type set to null when it can't be nullable`,
        );
      }
    });
  });

  test("polymorphic object, nullable true, type not set on create", async () => {
    class Contact extends User {}
    const ContactSchema = getBuilderSchemaFromFields(
      {
        foo_id: UUIDType({
          polymorphic: {
            types: ["bar", "baz"],
          },
          nullable: true,
        }),
      },
      Contact,
    );

    await doSQLiteTestFromSchemas([ContactSchema], async () => {
      const action = getInsertAction(
        ContactSchema,
        new Map<string, any>([["foo_id", v1()]]),
      );
      try {
        await action.saveX();
        throw new Error("should throw");
      } catch (err) {
        expect((err as Error).message).toBe(
          `field foo_type set to undefined when it can't be nullable`,
        );
      }
    });
  });

  test("polymorphic object, nullable true, type not set on update", async () => {
    class Contact extends User {}
    const ContactSchema = getBuilderSchemaFromFields(
      {
        foo_id: UUIDType({
          polymorphic: {
            types: ["bar", "baz"],
          },
          nullable: true,
        }),
      },
      Contact,
    );

    await doSQLiteTestFromSchemas([ContactSchema], async () => {
      const action = getInsertAction(
        ContactSchema,
        new Map<string, any>([
          ["foo_id", v1()],
          ["foo_type", "baz"],
        ]),
      );
      const ent1 = await action.saveX();
      expect(validate(ent1.data.foo_id)).toBe(true);
      expect(ent1.data.foo_type).toBe("baz");

      const action2 = getEditAction(
        ContactSchema,
        new Map<string, any>([["foo_id", v1()]]),
        ent1,
      );
      const ent2 = await action2.saveX();
      expect(ent2.data.foo_type).toBe("baz");
      expect(validate(ent2.data.foo_id)).toBe(true);

      expect(ent1.data.foo_id).not.toBe(ent2.data.foo_id);
    });
  });

  test("polymorphic object, nullable true, only type set to null", async () => {
    class Contact extends User {}
    const ContactSchema = getBuilderSchemaFromFields(
      {
        foo_id: UUIDType({
          polymorphic: {
            types: ["bar", "baz"],
          },
          nullable: true,
        }),
      },
      Contact,
    );

    await doSQLiteTestFromSchemas([ContactSchema], async () => {
      const action = getInsertAction(
        ContactSchema,
        new Map<string, any>([
          ["foo_id", v1()],
          ["foo_type", null],
        ]),
      );
      try {
        await action.saveX();
        throw new Error("should throw");
      } catch (err) {
        expect((err as Error).message).toBe(
          `field foo_type set to null when it can't be nullable`,
        );
      }
    });
  });

  test("polymorphic object, nullable true, both not set on create", async () => {
    class Contact extends User {}
    const ContactSchema = getBuilderSchemaFromFields(
      {
        foo_id: UUIDType({
          polymorphic: {
            types: ["bar", "baz"],
          },
          nullable: true,
        }),
      },
      Contact,
    );

    await doSQLiteTestFromSchemas([ContactSchema], async () => {
      const action = getInsertAction(ContactSchema, new Map<string, any>([]));
      const ent = await action.saveX();
      expect(ent.data.foo_id).toBe(null);
      expect(ent.data.foo_type).toBe(null);
    });
  });

  test("polymorphic object, nullable true, both set to null on create", async () => {
    class Contact extends User {}
    const ContactSchema = getBuilderSchemaFromFields(
      {
        foo_id: UUIDType({
          polymorphic: {
            types: ["bar", "baz"],
          },
          nullable: true,
        }),
      },
      Contact,
    );

    await doSQLiteTestFromSchemas([ContactSchema], async () => {
      const action = getInsertAction(
        ContactSchema,
        new Map<string, any>([
          ["foo_id", null],
          ["foo_type", null],
        ]),
      );
      const ent = await action.saveX();
      expect(ent.data.foo_id).toBe(null);
      expect(ent.data.foo_type).toBe(null);
    });
  });

  test("polymorphic object, nullable true, both changed to null on edit", async () => {
    class Contact extends User {}
    const ContactSchema = getBuilderSchemaFromFields(
      {
        foo_id: UUIDType({
          polymorphic: {
            types: ["bar", "baz"],
          },
          nullable: true,
        }),
      },
      Contact,
    );

    await doSQLiteTestFromSchemas([ContactSchema], async () => {
      const action = getInsertAction(
        ContactSchema,
        new Map<string, any>([
          ["foo_id", v1()],
          ["foo_type", "bar"],
        ]),
      );
      const ent = await action.saveX();
      expect(validate(ent.data.foo_id)).toBe(true);
      expect(ent.data.foo_type).toBe("bar");

      const action2 = getEditAction(
        ContactSchema,
        new Map<string, any>([
          ["foo_id", null],
          ["foo_type", null],
        ]),
        ent,
      );

      const ent2 = await action2.saveX();
      expect(ent2.data.foo_id).toBe(null);
      expect(ent2.data.foo_type).toBe(null);
    });
  });

  test("polymorphic object, nullable true, type valid", async () => {
    class Contact extends User {}
    const ContactSchema = getBuilderSchemaFromFields(
      {
        foo_id: UUIDType({
          polymorphic: {
            types: ["bar", "baz"],
          },
          nullable: true,
        }),
      },
      Contact,
    );

    await doSQLiteTestFromSchemas([ContactSchema], async () => {
      const action = getInsertAction(
        ContactSchema,
        new Map<string, any>([
          ["foo_id", v1()],
          ["foo_type", "bar"],
        ]),
      );
      const ent = await action.saveX();
      expect(validate(ent.data.foo_id)).toBe(true);
      expect(ent.data.foo_type).toBe("bar");
    });
  });

  test("polymorphic object, nullable true, type invalid", async () => {
    class Contact extends User {}
    const ContactSchema = getBuilderSchemaFromFields(
      {
        foo_id: UUIDType({
          polymorphic: {
            types: ["bar", "baz"],
          },
          nullable: true,
        }),
      },
      Contact,
    );

    await doSQLiteTestFromSchemas([ContactSchema], async () => {
      const action = getInsertAction(
        ContactSchema,
        new Map<string, any>([
          ["foo_id", v1()],
          ["foo_type", "hello"],
        ]),
      );
      try {
        await action.saveX();
        throw new Error("should throw");
      } catch (err) {
        expect((err as Error).message).toBe(
          "invalid field foo_type with value hello",
        );
      }
    });
  });

  test("polymorphic object, nullable true, id changed to null on edit", async () => {
    class Contact extends User {}
    const ContactSchema = getBuilderSchemaFromFields(
      {
        foo_id: UUIDType({
          polymorphic: {
            types: ["bar", "baz"],
          },
          nullable: true,
        }),
      },
      Contact,
    );

    await doSQLiteTestFromSchemas([ContactSchema], async () => {
      const action = getInsertAction(
        ContactSchema,
        new Map<string, any>([
          ["foo_id", v1()],
          ["foo_type", "bar"],
        ]),
      );
      const ent = await action.saveX();
      expect(validate(ent.data.foo_id)).toBe(true);
      expect(ent.data.foo_type).toBe("bar");

      const action2 = getEditAction(
        ContactSchema,
        new Map<string, any>([["foo_id", null]]),
        ent,
      );

      const ent2 = await action2.saveX();
      expect(ent2.data.foo_id).toBe(null);
      // sadly ok since we don't check id's value...
      expect(ent2.data.foo_type).toBe("bar");
    });
  });

  test("polymorphic object, nullable true, type changed to null on edit", async () => {
    class Contact extends User {}
    const ContactSchema = getBuilderSchemaFromFields(
      {
        foo_id: UUIDType({
          polymorphic: {
            types: ["bar", "baz"],
          },
          nullable: true,
        }),
      },
      Contact,
    );

    await doSQLiteTestFromSchemas([ContactSchema], async () => {
      const action = getInsertAction(
        ContactSchema,
        new Map<string, any>([
          ["foo_id", v1()],
          ["foo_type", "bar"],
        ]),
      );
      const ent = await action.saveX();
      expect(validate(ent.data.foo_id)).toBe(true);
      expect(ent.data.foo_type).toBe("bar");

      const action2 = getEditAction(
        ContactSchema,
        new Map<string, any>([["foo_type", null]]),
        ent,
      );

      try {
        await action2.saveX();
        throw new Error("should throw");
      } catch (err) {
        // can't change this on its own. have to change with foo_id
        expect((err as Error).message).toBe(
          `field foo_type set to null when it can't be nullable`,
        );
      }
    });
  });
  // TODO both undefined :()

  test("polymorphic object, types set. type lowerCase version", async () => {
    class Contact extends User {}
    const ContactSchema = getBuilderSchemaFromFields(
      {
        foo_id: UUIDType({
          polymorphic: {
            types: ["User", "Contact"],
          },
          nullable: true,
        }),
      },
      Contact,
    );

    await doSQLiteTestFromSchemas([ContactSchema], async () => {
      const action = getInsertAction(
        ContactSchema,
        new Map<string, any>([
          ["foo_id", v1()],
          ["foo_type", "user"],
        ]),
      );
      const ent = await action.saveX();
      expect(validate(ent.data.foo_id)).toBe(true);
      expect(ent.data.foo_type).toBe("user");
    });
  });

  test("polymorphic object, types set. type uppercase version", async () => {
    class Contact extends User {}
    const ContactSchema = getBuilderSchemaFromFields(
      {
        foo_id: UUIDType({
          polymorphic: {
            types: ["User", "Contact"],
          },
          nullable: true,
        }),
      },
      Contact,
    );

    await doSQLiteTestFromSchemas([ContactSchema], async () => {
      const action = getInsertAction(
        ContactSchema,
        new Map<string, any>([
          ["foo_id", v1()],
          ["foo_type", "User"],
        ]),
      );
      const ent = await action.saveX();
      expect(validate(ent.data.foo_id)).toBe(true);
      expect(ent.data.foo_type).toBe("user");
    });
  });

  test("polymorphic object, types set. type mixed case version", async () => {
    class Contact extends User {}
    const ContactSchema = getBuilderSchemaFromFields(
      {
        foo_id: UUIDType({
          polymorphic: {
            types: ["User", "Contact", "EventActivity"],
          },
          nullable: true,
        }),
      },
      Contact,
    );

    await doSQLiteTestFromSchemas([ContactSchema], async () => {
      const action = getInsertAction(
        ContactSchema,
        new Map<string, any>([
          ["foo_id", v1()],
          ["foo_type", "EventActivity"],
        ]),
      );
      const ent = await action.saveX();
      expect(validate(ent.data.foo_id)).toBe(true);
      expect(ent.data.foo_type).toBe("eventActivity");
    });
  });
});
