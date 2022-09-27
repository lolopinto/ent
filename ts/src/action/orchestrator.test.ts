import { advanceTo } from "jest-date-mock";
import {
  Builder,
  WriteOperation,
  Trigger,
  Validator,
  Observer,
} from "../action";
import {
  Ent,
  Viewer,
  ID,
  Data,
  PrivacyPolicy,
  DenyWithReason,
} from "../core/base";
import {
  EditNodeOperation,
  DeleteNodeOperation,
  DataOperation,
  loadRows,
} from "../core/ent";
import { LoggedOutViewer, IDViewer } from "../core/viewer";
import { Changeset } from "../action";
import {
  EnumField,
  EnumOptions,
  StringType,
  TimestampType,
  UUIDListType,
  UUIDType,
} from "../schema/field";
import { JSONBType } from "../schema/json_field";
import {
  User,
  Event,
  Contact,
  Address,
  SimpleBuilder,
  SimpleAction,
  getBuilderSchemaFromFields,
} from "../testutils/builder";
import { FakeComms, Mode } from "../testutils/fake_comms";
import { Pool } from "pg";
import { QueryRecorder } from "../testutils/db_mock";
import {
  AllowIfViewerRule,
  AlwaysAllowRule,
  DenyIfLoggedInRule,
  AlwaysDenyRule,
  DenyIfLoggedOutRule,
  AllowIfEntPropertyIsRule,
  AlwaysDenyPrivacyPolicy,
  AlwaysAllowPrivacyPolicy,
} from "../core/privacy";
import { createRowForTest } from "../testutils/write";
import * as clause from "../core/clause";
import { snakeCase } from "snake-case";
import { clearLogLevels, setLogLevels } from "../core/logger";

import { MockLogs } from "../testutils/mock_log";
import {
  assoc_edge_config_table,
  assoc_edge_table,
  getSchemaTable,
  setupSqlite,
  Table,
} from "../testutils/db/temp_db";
import { Dialect } from "../core/db";
import { convertDate, convertList } from "../core/convert";
import { v4 } from "uuid";

jest.mock("pg");
QueryRecorder.mockPool(Pool);

const edges = ["edge", "inverseEdge", "symmetricEdge"];
beforeEach(async () => {
  // does assoc_edge_config loader need to be cleared?
  for (const edge of edges) {
    await createRowForTest({
      tableName: "assoc_edge_config",
      fields: {
        edge_table: `${snakeCase(edge)}_table`,
        symmetric_edge: edge == "symmetricEdge",
        inverse_edge_type: edge === "edge" ? "inverseEdge" : "edge",
        edge_type: edge,
        edge_name: "name",
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
  }
});

afterEach(() => {
  QueryRecorder.clear();
  FakeComms.clear();
});

const UserSchema = getBuilderSchemaFromFields(
  {
    FirstName: StringType(),
    LastName: StringType(),
  },
  User,
);

class UserWithStatus extends User {}
const UserSchemaWithStatus = getBuilderSchemaFromFields(
  {
    FirstName: StringType(),
    LastName: StringType(),
    // let's assume this was hidden from the generated action and has to be set by the builder...
    account_status: StringType(),
  },
  UserWithStatus,
);

class UserExtended extends User {}

const UserSchemaExtended = getBuilderSchemaFromFields(
  {
    FirstName: StringType(),
    LastName: StringType(),
    account_status: StringType(),
    EmailAddress: StringType({ nullable: true }),
  },
  UserExtended,
);

class UserServerDefault extends User {}

const UserSchemaServerDefault = getBuilderSchemaFromFields(
  {
    FirstName: StringType(),
    LastName: StringType(),
    account_status: StringType({
      serverDefault: "ACTIVE",
    }),
  },
  UserServerDefault,
);

const UserSchemaDefaultValueOnCreate = getBuilderSchemaFromFields(
  {
    FirstName: StringType(),
    LastName: StringType(),
    account_status: StringType({
      defaultValueOnCreate: () => "ACTIVE",
    }),
  },
  UserServerDefault,
);

class UserDefaultValueOnCreate extends User {}

const UserSchemaDefaultValueOnCreateJSON = getBuilderSchemaFromFields(
  {
    FirstName: StringType(),
    LastName: StringType(),
    data: JSONBType({
      defaultValueOnCreate: () => ({}),
    }),
  },
  UserDefaultValueOnCreate,
);

const UserSchemaDefaultValueOnCreateInvalidJSON = getBuilderSchemaFromFields(
  {
    FirstName: StringType(),
    LastName: StringType(),
    data: JSONBType({
      defaultValueOnCreate: () => {},
    }),
  },
  UserDefaultValueOnCreate,
);

class UserWithProcessors extends User {}
const SchemaWithProcessors = getBuilderSchemaFromFields(
  {
    zip: StringType().match(/^\d{5}(-\d{4})?$/),
    username: StringType().toLowerCase(),
  },
  UserWithProcessors,
);

const AddressSchemaDerivedFields = getBuilderSchemaFromFields(
  {
    Street: StringType(),
    City: StringType(),
    State: StringType(),
    ZipCode: StringType(),
    Apartment: StringType({ nullable: true }),
    OwnerID: UUIDType({
      index: true,
      polymorphic: true,
    }),
  },
  Address,
);

const EventSchema = getBuilderSchemaFromFields(
  {
    startTime: TimestampType(),
    endTime: TimestampType(),
  },
  Event,
);

const ContactSchema = getBuilderSchemaFromFields(
  {
    FirstName: StringType(),
    LastName: StringType(),
    UserID: StringType({
      defaultValueOnCreate: (builder) => builder.viewer.viewerID,
    }),
    email_ids: UUIDListType({
      nullable: true,
    }),
  },
  Contact,
);

const ContactSchema2 = getBuilderSchemaFromFields(
  {
    FirstName: StringType(),
    LastName: StringType(),
    UserID: StringType({
      defaultToViewerOnCreate: true,
    }),
  },
  Contact,
);

class DefaultEnumField extends EnumField {
  constructor(options?: EnumOptions) {
    super({
      ...options,
    });
  }

  defaultValueOnCreate() {
    return "default";
  }
}

class CustomContact extends Contact {}

const ContactSchema3 = getBuilderSchemaFromFields(
  {
    FirstName: StringType(),
    LastName: StringType(),
    UserID: StringType({
      defaultToViewerOnCreate: true,
    }),
    label: new DefaultEnumField({
      values: ["default", "work", "mobile"],
    }),
  },
  CustomContact,
);

class ContactEmail extends Contact {}

const ContactEmailSchema = getBuilderSchemaFromFields(
  {
    contactId: UUIDType(),
    email: StringType(),
  },
  ContactEmail,
);

class CustomUser implements Ent {
  id: ID;
  accountID: string = "";
  nodeType = "User";
  getPrivacyPolicy() {
    return {
      rules: [AllowIfViewerRule, AlwaysDenyRule],
    };
  }
  constructor(public viewer: Viewer, public data: Data) {
    this.id = data.id;
  }
}

const CustomUserSchema = getBuilderSchemaFromFields(
  {
    FirstName: StringType(),
    LastName: StringType(),
  },
  CustomUser,
);

class SensitiveUser extends User {}
const SensitiveValuesSchema = getBuilderSchemaFromFields(
  {
    FirstName: StringType(),
    LastName: StringType({ sensitive: true }),
  },
  SensitiveUser,
);

class NullableEvent extends Event {}

const SchemaWithNullFields = getBuilderSchemaFromFields(
  {
    startTime: TimestampType(),
    endTime: TimestampType({
      nullable: true,
    }),
  },
  NullableEvent,
);

describe("postgres", () => {
  commonTests();
});

describe("sqlite", () => {
  const getTables = () => {
    const tables: Table[] = [assoc_edge_config_table()];
    edges.map((edge) =>
      tables.push(assoc_edge_table(`${snakeCase(edge)}_table`)),
    );

    [
      UserSchema,
      UserSchemaWithStatus,
      UserSchemaExtended,
      UserSchemaServerDefault,
      UserSchemaDefaultValueOnCreate,
      UserSchemaDefaultValueOnCreateJSON,
      UserSchemaDefaultValueOnCreateInvalidJSON,
      SchemaWithProcessors,
      EventSchema,
      AddressSchemaDerivedFields,
      ContactSchema,
      ContactSchema3,
      CustomUserSchema,
      ContactEmailSchema,
      SensitiveValuesSchema,
      SchemaWithNullFields,
    ].map((s) => tables.push(getSchemaTable(s, Dialect.SQLite)));
    return tables;
  };

  setupSqlite(`sqlite:///orchestrator-test.db`, getTables);
  commonTests();
});

function getInsertUserAction(
  map: Map<string, any>,
  viewer: Viewer = new LoggedOutViewer(),
) {
  return new SimpleAction(viewer, UserSchema, map, WriteOperation.Insert, null);
}

function getInsertUserBuilder(
  map: Map<string, any>,
  viewer: Viewer = new LoggedOutViewer(),
) {
  return new SimpleBuilder(
    viewer,
    UserSchema,
    map,
    WriteOperation.Insert,
    null,
  );
}

function commonTests() {
  test("schema on create", async () => {
    const builder = getInsertUserBuilder(
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
    );

    const fields = await getFieldsFromBuilder(builder);
    expect(fields["first_name"]).toBe("Jon");
    expect(fields["last_name"]).toBe("Snow");
    validateFieldsExist(fields, "id", "created_at", "updated_at");
  });

  test("missing required field", async () => {
    const builder = getInsertUserBuilder(
      new Map([
        ["FirstName", "Jon"],
        // non-nullable field set to null
        // simulating what the generated builder will do
        ["LastName", null],
      ]),
    );

    try {
      await builder.build();
      throw new Error("should have thrown exception");
    } catch (e) {
      expect(e.message).toBe(
        "field LastName set to null for non-nullable field",
      );
    }
  });

  test("missing required field with validWithError", async () => {
    const builder = getInsertUserBuilder(
      new Map([
        ["FirstName", "Jon"],
        // non-nullable field set to null
        // simulating what the generated builder will do
        ["LastName", null],
      ]),
    );

    const errors = await builder.orchestrator.validWithErrors();
    expect(errors.length).toBe(1);
    expect(errors[0].message).toBe(
      "field LastName set to null for non-nullable field",
    );
  });

  // if somehow builder logic doesn't handle this, we still catch this for create
  // should this be default and simplify builders?
  test("required field not set", async () => {
    const builder = getInsertUserBuilder(new Map([["FirstName", "Jon"]]));

    try {
      await builder.build();
      throw new Error("should have thrown exception");
    } catch (e) {
      expect(e.message).toBe("required field LastName not set");
    }
  });

  test("required field fine when server default exists", async () => {
    const builder = new SimpleBuilder(
      new LoggedOutViewer(),
      UserSchemaServerDefault,
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
      WriteOperation.Insert,
      null,
    );

    await builder.build();
  });

  test("required field fine when default value on create exists", async () => {
    const builder = new SimpleBuilder(
      new LoggedOutViewer(),
      UserSchemaDefaultValueOnCreate,
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
      WriteOperation.Insert,
      null,
    );

    await builder.build();
  });

  test("required field fine when default value on create json ", async () => {
    const builder = new SimpleBuilder(
      new LoggedOutViewer(),
      UserSchemaDefaultValueOnCreateJSON,
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
      WriteOperation.Insert,
      null,
    );

    await builder.build();
  });

  test("required field when default value on create json wrong", async () => {
    const builder = new SimpleBuilder(
      new LoggedOutViewer(),
      UserSchemaDefaultValueOnCreateInvalidJSON,
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
      WriteOperation.Insert,
      null,
    );

    try {
      await builder.build();
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as Error).message).toBe(
        "defaultValueOnCreate() returned undefined for field data",
      );
    }
  });

  test("schema on edit", async () => {
    const user = new User(new LoggedOutViewer(), { id: "1" });
    const builder = new SimpleBuilder(
      new LoggedOutViewer(),
      UserSchema,
      // field that's not changed isn't set...
      // simulating what the generated builder will do
      new Map([["LastName", "Targaryen"]]),
      WriteOperation.Edit,
      user,
    );

    const fields = await getFieldsFromBuilder(builder);
    expect(fields["last_name"]).toBe("Targaryen");
    validateFieldsExist(fields, "updated_at");
    validateFieldsDoNotExist(fields, "id", "created_at");
  });

  test("schema on delete", async () => {
    const user = new User(new LoggedOutViewer(), { id: "1" });
    const builder = new SimpleBuilder(
      new LoggedOutViewer(),
      UserSchema,
      new Map(),
      WriteOperation.Delete,
      user,
    );

    const c = await builder.build();
    const ops = getOperations(c);
    expect(ops.length).toBe(1);
    expect(ops[0]).toBeInstanceOf(DeleteNodeOperation);
  });

  test("schema with null fields", async () => {
    const d = new Date();
    const builder = new SimpleBuilder(
      new LoggedOutViewer(),
      SchemaWithNullFields,
      new Map([["startTime", d]]),
      WriteOperation.Insert,
      null,
    );

    const fields = await getFieldsFromBuilder(builder);
    expect(fields["start_time"]).toBeDefined();
    expect(fields["start_time"]).toEqual(d.toISOString());
    validateFieldsExist(fields, "id", "created_at", "updated_at");
    validateFieldsDoNotExist(fields, "end_time");

    await builder.saveX();
    const evt = await builder.editedEntX();
    expect(convertDate(evt.data.start_time).toISOString()).toBe(
      d.toISOString(),
    );
    // undefined in fake postgres, null in sqlite
    expect(evt.data.end_time).toBeFalsy();

    const builder2 = new SimpleBuilder(
      new LoggedOutViewer(),
      SchemaWithNullFields,
      new Map([
        ["startTime", d],
        ["endTime", d],
      ]),
      WriteOperation.Insert,
      null,
    );
    const fields2 = await getFieldsFromBuilder(builder2);
    expect(fields2["start_time"]).toBeDefined();
    expect(fields2["start_time"]).toEqual(d.toISOString());

    validateFieldsExist(fields2, "id", "created_at", "updated_at");

    await builder2.saveX();
    const evt2 = await builder2.editedEntX();
    expect(convertDate(evt2.data.start_time).toISOString()).toBe(
      d.toISOString(),
    );
    expect(convertDate(evt2.data.end_time).toISOString()).toBe(d.toISOString());

    const builder3 = new SimpleBuilder(
      new LoggedOutViewer(),
      SchemaWithNullFields,
      new Map([["endTime", null]]),
      WriteOperation.Edit,
      evt2,
    );

    await builder3.saveX();
    const evt3 = await builder3.editedEntX();
    expect(convertDate(evt3.data.start_time).toISOString()).toBe(
      d.toISOString(),
    );
    expect(evt3.data.end_time).toBeNull();
  });

  test("schema_with_overriden_storage_key", async () => {
    const SchemaWithOverridenDBKey = getBuilderSchemaFromFields(
      {
        emailAddress: StringType({ storageKey: "email" }),
      },
      User,
    );

    const builder = new SimpleBuilder(
      new LoggedOutViewer(),
      SchemaWithOverridenDBKey,
      new Map([["emailAddress", "test@email.com"]]),
      WriteOperation.Insert,
      null,
    );

    const fields = await getFieldsFromBuilder(builder);
    expect(fields["email"]).toBe("test@email.com");
    validateFieldsExist(fields, "id", "created_at", "updated_at");
  });

  describe("schema_with_processors", () => {
    test("simple case", async () => {
      const builder = new SimpleBuilder(
        new LoggedOutViewer(),
        SchemaWithProcessors,
        new Map([
          ["username", "lolopinto"],
          ["zip", "94114"],
        ]),
        WriteOperation.Insert,
        null,
      );

      const fields = await getFieldsFromBuilder(builder);
      expect(fields["username"]).toBe("lolopinto");
      expect(fields["zip"]).toBe("94114");
      validateFieldsExist(fields, "id", "created_at", "updated_at");
    });

    test("username lowered", async () => {
      const builder = new SimpleBuilder(
        new LoggedOutViewer(),
        SchemaWithProcessors,
        new Map([
          ["username", "LOLOPINTO"],
          ["zip", "94114"],
        ]),
        WriteOperation.Insert,
        null,
      );

      const fields = await getFieldsFromBuilder(builder);
      expect(fields["username"]).toBe("lolopinto");
      expect(fields["zip"]).toBe("94114");
      validateFieldsExist(fields, "id", "created_at", "updated_at");
    });

    test("invalid zip", async () => {
      const builder = new SimpleBuilder(
        new LoggedOutViewer(),
        SchemaWithProcessors,
        new Map([
          ["username", "LOLOPINTO"],
          ["zip", "941"],
        ]),
        WriteOperation.Insert,
        null,
      );

      try {
        await builder.build();
        throw new Error("should not have gotten here");
      } catch (e) {
        expect(e.message).toBe("invalid field zip with value 941");
      }
    });

    test("invalid zip with validWithErrors", async () => {
      const builder = new SimpleBuilder(
        new LoggedOutViewer(),
        SchemaWithProcessors,
        new Map([
          ["username", "LOLOPINTO"],
          ["zip", "941"],
        ]),
        WriteOperation.Insert,
        null,
      );

      const errors = await builder.orchestrator.validWithErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].message).toBe("invalid field zip with value 941");
    });
  });

  describe("validators", () => {
    const validators: Validator<Event, SimpleBuilder<Event>>[] = [
      {
        validate: async (builder): Promise<void> => {
          let startTime: Date = builder.fields.get("startTime");
          let endTime: Date = builder.fields.get("endTime");

          if (!startTime || !endTime) {
            throw new Error("startTime and endTime required");
          }

          if (startTime.getTime() > endTime.getTime()) {
            throw new Error("start time cannot be after end time");
          }
        },
      },
    ];

    const validators2: Validator<Event, SimpleBuilder<Event>>[] = [
      {
        validate: async (builder): Promise<Error | undefined> => {
          let startTime: Date = builder.fields.get("startTime");
          let endTime: Date = builder.fields.get("endTime");

          if (!startTime || !endTime) {
            return new Error("startTime and endTime required");
          }

          if (startTime.getTime() > endTime.getTime()) {
            return new Error("start time cannot be after end time");
          }
          return;
        },
      },
    ];

    test("invalid. validX", async () => {
      let now = new Date();
      let yesterday = new Date(now.getTime() - 86400);

      let action = new SimpleAction(
        new LoggedOutViewer(),
        EventSchema,
        new Map([
          ["startTime", now],
          ["endTime", yesterday],
        ]),
        WriteOperation.Insert,
        null,
      );
      action.getValidators = () => validators;

      try {
        await action.validX();
        throw new Error("should have thrown exception");
      } catch (e) {
        expect(e.message).toBe("start time cannot be after end time");
      }
    });

    test("invalid. validX with validator which returns error", async () => {
      let now = new Date();
      let yesterday = new Date(now.getTime() - 86400);

      let action = new SimpleAction(
        new LoggedOutViewer(),
        EventSchema,
        new Map([
          ["startTime", now],
          ["endTime", yesterday],
        ]),
        WriteOperation.Insert,
        null,
      );
      action.getValidators = () => validators2;

      try {
        await action.validX();
        throw new Error("should have thrown exception");
      } catch (e) {
        expect(e.message).toBe("start time cannot be after end time");
      }
    });

    test("invalid. valid", async () => {
      let now = new Date();
      let yesterday = new Date(now.getTime() - 86400);

      let action = new SimpleAction(
        new LoggedOutViewer(),
        EventSchema,
        new Map([
          ["startTime", now],
          ["endTime", yesterday],
        ]),
        WriteOperation.Insert,
        null,
      );
      action.getValidators = () => validators;

      const valid = await action.valid();
      expect(valid).toBe(false);
    });

    test("invalid. validWithErrors", async () => {
      let now = new Date();
      let yesterday = new Date(now.getTime() - 86400);

      let action = new SimpleAction(
        new LoggedOutViewer(),
        EventSchema,
        new Map([
          ["startTime", now],
          ["endTime", yesterday],
        ]),
        WriteOperation.Insert,
        null,
      );
      action.getValidators = () => validators;

      const errors = await action.builder.orchestrator.validWithErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].message).toBe("start time cannot be after end time");
    });

    test("validX", async () => {
      let now = new Date();
      let yesterday = new Date(now.getTime() - 86400);

      let action = new SimpleAction(
        new LoggedOutViewer(),
        EventSchema,
        new Map([
          ["startTime", yesterday],
          ["endTime", now],
        ]),
        WriteOperation.Insert,
        null,
      );
      action.getValidators = () => validators;

      await action.validX();

      // can "save" the query!
      await action.saveX();
    });

    test("valid", async () => {
      let now = new Date();
      let yesterday = new Date(now.getTime() - 86400);

      let action = new SimpleAction(
        new LoggedOutViewer(),
        EventSchema,
        new Map([
          ["startTime", yesterday],
          ["endTime", now],
        ]),
        WriteOperation.Insert,
        null,
      );
      action.getValidators = () => validators;

      const valid = await action.valid();
      expect(valid).toBe(true);
    });

    test("validWithErrors", async () => {
      let now = new Date();
      let yesterday = new Date(now.getTime() - 86400);

      let action = new SimpleAction(
        new LoggedOutViewer(),
        EventSchema,
        new Map([
          ["startTime", yesterday],
          ["endTime", now],
        ]),
        WriteOperation.Insert,
        null,
      );
      action.getValidators = () => validators;

      const errors = await action.builder.orchestrator.validWithErrors();
      expect(errors.length).toBe(0);
    });
  });

  describe("privacyPolicy", () => {
    test("valid", async () => {
      let action = getInsertUserAction(
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
      );
      action.getPrivacyPolicy = () => {
        return {
          rules: [DenyIfLoggedInRule, AlwaysAllowRule],
        };
      };
      let valid = await action.valid();
      expect(valid).toBe(true);
    });

    test("invalid", async () => {
      const viewer = new IDViewer("1");
      const action = getInsertUserAction(
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
        viewer,
      );
      action.getPrivacyPolicy = () => {
        return {
          rules: [DenyIfLoggedInRule, AlwaysAllowRule],
        };
      };
      let valid = await action.valid();
      expect(valid).toBe(false);
    });

    test("validWithErrors", async () => {
      const viewer = new IDViewer("1");
      const action = getInsertUserAction(
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
        viewer,
      );
      action.getPrivacyPolicy = () => {
        return {
          rules: [DenyIfLoggedInRule, AlwaysAllowRule],
        };
      };
      let errors = await action.validWithErrors();
      expect(errors.length).toBe(1);
    });

    test("invalidX. create", async () => {
      const viewer = new IDViewer("1");
      const action = getInsertUserAction(
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
        viewer,
      );
      action.getPrivacyPolicy = () => {
        return {
          rules: [DenyIfLoggedInRule, AlwaysAllowRule],
        };
      };
      try {
        await action.validX();
        throw new Error("should have thrown");
      } catch (e) {
        expect(e.message).toMatch(
          /Viewer with ID 1 does not have permission to create User/,
        );
      }
    });

    test("invalidX. edit", async () => {
      const viewer = new IDViewer("1");
      const action = new SimpleAction(
        viewer,
        UserSchema,
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
        WriteOperation.Edit,
        new User(new LoggedOutViewer(), { id: "1" }),
      );
      action.getPrivacyPolicy = () => {
        return {
          rules: [DenyIfLoggedInRule, AlwaysAllowRule],
        };
      };
      try {
        await action.validX();
        throw new Error("should have thrown");
      } catch (e) {
        expect(e.message).toMatch(
          /Viewer with ID 1 does not have permission to edit User/,
        );
      }
    });

    test("invalidX. delete", async () => {
      const viewer = new IDViewer("1");
      const action = new SimpleAction(
        viewer,
        UserSchema,
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
        WriteOperation.Delete,
        new User(new LoggedOutViewer(), { id: "1" }),
      );
      action.getPrivacyPolicy = () => {
        return {
          rules: [DenyIfLoggedInRule, AlwaysAllowRule],
        };
      };
      try {
        await action.validX();
        throw new Error("should have thrown");
      } catch (e) {
        expect(e.message).toMatch(
          /Viewer with ID 1 does not have permission to delete User/,
        );
      }
    });

    test("invalidX. logged out. delete", async () => {
      const viewer = new LoggedOutViewer();
      const action = new SimpleAction(
        viewer,
        UserSchema,
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
        WriteOperation.Delete,
        new User(new LoggedOutViewer(), { id: "1" }),
      );
      action.getPrivacyPolicy = () => {
        return {
          rules: [DenyIfLoggedOutRule, AlwaysAllowRule],
        };
      };
      try {
        await action.validX();
        throw new Error("should have thrown");
      } catch (e) {
        expect(e.message).toMatch(
          /Logged out Viewer does not have permission to delete User/,
        );
      }
    });

    test("unsafe ent in creation. valid", async () => {
      let action = getInsertUserAction(
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
      );
      action.getPrivacyPolicy = () => {
        return {
          rules: [
            new AllowIfEntPropertyIsRule<User>("firstName", "Jon"),
            AlwaysDenyRule,
          ],
        };
      };
      let valid = await action.valid();
      expect(valid).toBe(true);
    });

    test("unsafe ent in creation. invalid", async () => {
      let action = getInsertUserAction(
        new Map([
          ["FirstName", "Sansa"],
          ["LastName", "Snow"],
        ]),
      );
      action.getPrivacyPolicy = () => {
        return {
          rules: [
            new AllowIfEntPropertyIsRule<User>("firstName", "Jon"),
            AlwaysDenyRule,
          ],
        };
      };
      let valid = await action.valid();
      expect(valid).toBe(false);
    });

    test("cannot create and load ent. create error wins", async () => {
      class DenyAllUser extends User {
        getPrivacyPolicy(): PrivacyPolicy<this> {
          return AlwaysDenyPrivacyPolicy;
        }
      }

      const DenyUserSchema = getBuilderSchemaFromFields(
        {
          FirstName: StringType(),
          LastName: StringType(),
        },
        DenyAllUser,
      );

      const action = new SimpleAction(
        new LoggedOutViewer(),
        DenyUserSchema,
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
        WriteOperation.Insert,
        null,
      );
      action.getPrivacyPolicy = () => {
        return AlwaysDenyPrivacyPolicy;
      };

      await expect(action.saveX()).rejects.toThrowError(
        "Logged out Viewer does not have permission to create DenyAllUser",
      );
    });

    test("dependent triggers and policies behave as expected", async () => {
      class DenyAllUser extends User {
        getPrivacyPolicy(): PrivacyPolicy<this> {
          return AlwaysDenyPrivacyPolicy;
        }
      }

      class DenyAllAccount extends User {
        getPrivacyPolicy(): PrivacyPolicy<this> {
          return AlwaysDenyPrivacyPolicy;
        }
      }

      const DenyUserSchema = getBuilderSchemaFromFields(
        {
          FirstName: StringType(),
          LastName: StringType(),
        },
        DenyAllUser,
      );

      const DenyAccountSchema = getBuilderSchemaFromFields(
        {
          FirstName: StringType(),
          LastName: StringType(),
        },
        DenyAllAccount,
      );

      const action = new SimpleAction(
        new LoggedOutViewer(),
        DenyUserSchema,
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
        WriteOperation.Insert,
        null,
      );
      action.getPrivacyPolicy = () => {
        return {
          rules: [
            {
              async apply(v, ent?) {
                return DenyWithReason("thou shall not pass. DenyUser");
              },
            },
            AlwaysDenyRule,
          ],
        };
      };
      action.getTriggers = () => [
        {
          changeset(builder, input) {
            const action2 = new SimpleAction(
              new LoggedOutViewer(),
              DenyAccountSchema,
              new Map([
                ["FirstName", "Jon"],
                ["LastName", "Snow"],
              ]),
              WriteOperation.Insert,
              null,
            );
            action2.getPrivacyPolicy = () => {
              return {
                rules: [
                  {
                    async apply(v, ent?) {
                      return DenyWithReason("thou shall not pass. DenyAccount");
                    },
                  },
                  AlwaysDenyRule,
                ],
              };
            };
            return action2.changeset();
          },
        },
      ];

      await expect(action.saveX()).rejects.toThrowError(
        "thou shall not pass. DenyUser",
      );
    });

    test("dependent triggers and policies behave as expected 2", async () => {
      class DenyAllUser extends User {
        getPrivacyPolicy(): PrivacyPolicy<this> {
          return AlwaysAllowPrivacyPolicy;
        }
      }

      class DenyAllAccount extends User {
        getPrivacyPolicy(): PrivacyPolicy<this> {
          return AlwaysAllowPrivacyPolicy;
        }
      }

      const DenyUserSchema = getBuilderSchemaFromFields(
        {
          FirstName: StringType(),
          LastName: StringType(),
        },
        DenyAllUser,
      );

      const DenyAccountSchema = getBuilderSchemaFromFields(
        {
          FirstName: StringType(),
          LastName: StringType(),
        },
        DenyAllAccount,
      );

      const action = new SimpleAction(
        new LoggedOutViewer(),
        DenyUserSchema,
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
        WriteOperation.Insert,
        null,
      );
      action.getPrivacyPolicy = () => {
        return AlwaysAllowPrivacyPolicy;
      };
      action.getTriggers = () => [
        {
          changeset(builder, input) {
            const action2 = new SimpleAction(
              new LoggedOutViewer(),
              DenyAccountSchema,
              new Map([
                ["FirstName", "Jon"],
                ["LastName", "Snow"],
              ]),
              WriteOperation.Insert,
              null,
            );
            action2.getPrivacyPolicy = () => {
              return {
                rules: [
                  {
                    async apply(v, ent?) {
                      return DenyWithReason("thou shall not pass. DenyAccount");
                    },
                  },
                  AlwaysDenyRule,
                ],
              };
            };
            return action2.changeset();
          },
        },
      ];

      await expect(action.saveX()).rejects.toThrowError(
        "thou shall not pass. DenyAccount",
      );
    });
  });

  describe("trigger", () => {
    let now = new Date();

    const accountStatusTrigger: Trigger<
      UserWithStatus,
      SimpleBuilder<UserWithStatus>
    > = {
      changeset: (builder: SimpleBuilder<UserWithStatus>): void => {
        builder.fields.set("account_status", "VALID");
      },
    };
    const triggers = [accountStatusTrigger];

    test("update builder", async () => {
      advanceTo(now);
      const viewer = new IDViewer("11");
      const action = new SimpleAction(
        viewer,
        UserSchemaWithStatus,
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
        WriteOperation.Insert,
        null,
      );

      action.getTriggers = () => triggers;
      const user = await action.saveX();
      if (!user) {
        throw new Error("couldn't save user");
      }

      expect(user.data).toEqual({
        id: user.id,
        created_at: now,
        updated_at: now,
        first_name: "Jon",
        last_name: "Snow",
        account_status: "VALID",
      });
    });

    test("new changeset", async () => {
      advanceTo(now);

      const viewer = new IDViewer("1");
      let contactAction: SimpleAction<Contact>;
      const action = new SimpleAction(
        viewer,
        UserSchemaWithStatus,
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
        WriteOperation.Insert,
        null,
      );
      // also create a contact when we create a user
      action.getTriggers = () => [
        accountStatusTrigger,
        {
          changeset: (
            builder: SimpleBuilder<UserWithStatus>,
          ): Promise<Changeset> => {
            let firstName = builder.fields.get("FirstName");
            let lastName = builder.fields.get("LastName");
            contactAction = new SimpleAction(
              viewer,
              ContactSchema,
              new Map([
                ["FirstName", firstName],
                ["LastName", lastName],
                ["UserID", builder],
              ]),
              WriteOperation.Insert,
              null,
            );
            return contactAction.changeset();
          },
        },
      ];

      // this returned a Contact not a User
      // this didn't replace the builder
      const user = await action.saveX();
      if (!user) {
        throw new Error("couldn't save user");
      }
      expect(user.data).toMatchObject({
        id: user.id,
        created_at: now,
        updated_at: now,
        first_name: "Jon",
        last_name: "Snow",
        account_status: "VALID",
        // email_ids: null in sqlite
      });

      // let's inspect the created contact
      expect(contactAction!).not.toBe(null);
      let contact = await contactAction!.builder.orchestrator.editedEnt();
      if (!contact) {
        throw new Error("couldn't save contact");
      }
      expect(contact.data).toMatchObject({
        id: contact.id,
        created_at: now,
        updated_at: now,
        first_name: "Jon",
        last_name: "Snow",
        user_id: user.id, // created contact and set the user_id correctly
        // email_ids: null in sqlite
      });
    });
  });

  describe("observer", () => {
    let now = new Date();

    test("no email sent", async () => {
      advanceTo(now);
      const viewer = new IDViewer("11");
      const action = new SimpleAction(
        viewer,
        UserSchemaExtended,
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
          ["account_status", "UNVERIFIED"],
        ]),
        WriteOperation.Insert,
        null,
      );
      action.getObservers = () => [sendEmailObserver];

      const user = await action.saveX();
      if (!user) {
        throw new Error("couldn't save user");
      }

      expect(user.data).toMatchObject({
        id: user.id,
        created_at: now,
        updated_at: now,
        first_name: "Jon",
        last_name: "Snow",
        account_status: "UNVERIFIED",
      });
      FakeComms.verifyNoEmailSent();
    });

    test("email sent", async () => {
      advanceTo(now);
      const viewer = new IDViewer("11");
      const action = new SimpleAction(
        viewer,
        UserSchemaExtended,
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
          ["EmailAddress", "foo@email.com"],
          ["account_status", "UNVERIFIED"],
        ]),
        WriteOperation.Insert,
        null,
      );
      action.getObservers = () => [sendEmailObserver];

      const user = await action.saveX();
      if (!user) {
        throw new Error("couldn't save user");
      }

      expect(user.data).toEqual({
        id: user.id,
        created_at: now,
        updated_at: now,
        first_name: "Jon",
        last_name: "Snow",
        email_address: "foo@email.com",
        account_status: "UNVERIFIED",
      });

      FakeComms.verifySent("foo@email.com", Mode.EMAIL, {
        subject: "Welcome, Jon!",
        body: "Hi Jon, thanks for joining fun app!",
      });
    });

    test("email sent async observer", async () => {
      advanceTo(now);
      const viewer = new IDViewer("11");
      const action = new SimpleAction(
        viewer,
        UserSchemaExtended,
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
          ["EmailAddress", "foo@email.com"],
          ["account_status", "UNVERIFIED"],
        ]),
        WriteOperation.Insert,
        null,
      );
      action.getObservers = () => [sendEmailObserverAsync];

      const user = await action.saveX();
      if (!user) {
        throw new Error("couldn't save user");
      }

      expect(user.data).toEqual({
        id: user.id,
        created_at: now,
        updated_at: now,
        first_name: "Jon",
        last_name: "Snow",
        email_address: "foo@email.com",
        account_status: "UNVERIFIED",
      });

      FakeComms.verifySent("foo@email.com", Mode.EMAIL, {
        subject: "Welcome, Jon!",
        body: "Hi Jon, thanks for joining fun app!",
      });
    });
  });

  describe("combo", () => {
    const createAction = (
      viewer: Viewer,
      fields: Map<string, any>,
    ): SimpleAction<UserExtended> => {
      const action = new SimpleAction(
        viewer,
        UserSchemaExtended,
        fields,
        WriteOperation.Insert,
        null,
      );
      action.getTriggers = () => [
        {
          changeset: (builder: SimpleBuilder<UserExtended>): void => {
            builder.fields.set("account_status", "VALID");
          },
        },
      ];
      action.getPrivacyPolicy = () => {
        return {
          rules: [DenyIfLoggedInRule, AlwaysAllowRule],
        };
      };
      action.getValidators = () => [
        {
          validate: async (
            builder: SimpleBuilder<UserExtended>,
          ): Promise<void> => {
            let fields = builder.fields;
            if (fields.get("LastName") !== "Snow") {
              throw new Error("only Jon Snow's name is valid");
            }
          },
        },
      ];
      action.getObservers = () => [sendEmailObserver];
      return action;
    };

    test("success", async () => {
      let now = new Date();
      let action = createAction(
        new LoggedOutViewer(),
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
      );
      advanceTo(now);

      const user = await action.saveX();
      if (!user) {
        throw new Error("couldn't save user");
      }

      expect(user.data).toMatchObject({
        id: user.id,
        created_at: now,
        updated_at: now,
        first_name: "Jon",
        last_name: "Snow",
        account_status: "VALID",
      });
      FakeComms.verifyNoEmailSent();
    });

    test("success with email", async () => {
      let now = new Date();
      let action = createAction(
        new LoggedOutViewer(),
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
          ["EmailAddress", "foo@email.com"],
        ]),
      );
      advanceTo(now);

      const user = await action.saveX();
      if (!user) {
        throw new Error("couldn't save user");
      }

      expect(user.data).toEqual({
        id: user.id,
        created_at: now,
        updated_at: now,
        first_name: "Jon",
        last_name: "Snow",
        account_status: "VALID",
        email_address: "foo@email.com",
      });
      FakeComms.verifySent("foo@email.com", Mode.EMAIL, {
        subject: "Welcome, Jon!",
        body: "Hi Jon, thanks for joining fun app!",
      });
    });

    test("privacy", async () => {
      let action = createAction(
        new IDViewer("1"),
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
          ["EmailAddress", "foo@email.com"],
        ]),
      );

      try {
        await action.saveX();
        throw new Error("expected error");
      } catch (err) {
        expect(err.message).toMatch(
          /Viewer with ID 1 does not have permission to create UserExtended$/,
        );
      }
      FakeComms.verifyNoEmailSent();
    });

    test("privacy no exceptions", async () => {
      let action = createAction(
        new IDViewer("1"),
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
          ["EmailAddress", "foo@email.com"],
        ]),
      );

      let ent = await action.save();
      expect(ent).toBe(null);
      FakeComms.verifyNoEmailSent();
    });
  });

  // TODO serverDefault change...

  test("schema with derived fields", async () => {
    const user = new User(new LoggedOutViewer(), { id: v4() });

    const builder = new SimpleBuilder(
      new LoggedOutViewer(),
      AddressSchemaDerivedFields,
      new Map([
        ["Street", "1600 Pennsylvania Avenue NW"],
        ["City", "Washington DC"],
        ["State", "DC"],
        ["ZipCode", "20500"],
        ["OwnerID", user.id],
        ["OwnerType", user.nodeType],
      ]),
      WriteOperation.Insert,
      null,
    );

    const fields = await getFieldsFromBuilder(builder);
    expect(fields["owner_id"]).toBe(user.id);
    expect(fields["owner_type"]).toBe(user.nodeType);
  });

  describe("viewer for ent load", () => {
    async function createUser(): Promise<CustomUser> {
      let action = new SimpleAction(
        new LoggedOutViewer(),
        CustomUserSchema,
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
        WriteOperation.Insert,
        null,
      );
      action.viewerForEntLoad = (data: Data) => {
        // load the created ent using a VC of the newly created user.
        return new IDViewer(data.id);
      };

      const user = await action.saveX();
      expect(user).toBeInstanceOf(CustomUser);
      if (user) {
        return user;
      }
      throw new Error("Impossible");
    }

    test("loadable with viewer", async () => {
      await createUser();
    });

    test("can create but can't load user", async () => {
      let action = new SimpleAction(
        new LoggedOutViewer(),
        CustomUserSchema,
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
        WriteOperation.Insert,
        null,
      );
      try {
        await action.saveX();
        throw new Error("should have thrown exception");
      } catch (e) {
        expect(e.message).toBe("was able to create ent but not load it");
      }
    });

    test("can edit but can't load user", async () => {
      const user = await createUser();
      let action = new SimpleAction(
        new LoggedOutViewer(),
        CustomUserSchema,
        new Map([["LastName", "Snow2"]]),
        WriteOperation.Edit,
        user,
      );
      try {
        await action.saveX();
        throw new Error("should have thrown exception");
      } catch (e) {
        expect(e.message).toBe("was able to edit ent but not load it");
      }
    });

    test("can edit, loadable with viewer", async () => {
      const user = await createUser();
      let action = new SimpleAction(
        // should probably not used a LoggedOutViewer here but for testing purposes...
        // and SimpleAction defaults to AlwaysAllowPrivacyPolicy
        new LoggedOutViewer(),
        CustomUserSchema,
        new Map([["LastName", "Snow2"]]),
        WriteOperation.Edit,
        user,
      );
      action.viewerForEntLoad = (data: Data) => {
        // load the edited ent using a VC of the user
        return new IDViewer(data.id);
      };

      const editedUser = await action.saveX();
      expect(editedUser).toBeInstanceOf(CustomUser);
    });
  });

  describe("logging queries", () => {
    let mockLog = new MockLogs();

    beforeAll(() => {
      mockLog.mock();
      setLogLevels(["query", "cache"]);
    });

    afterAll(() => {
      mockLog.restore();
      clearLogLevels();
    });

    beforeEach(() => {
      mockLog.clear();
    });

    test("regular", async () => {
      let action = new SimpleAction(
        new LoggedOutViewer(),
        UserSchema,
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
        WriteOperation.Insert,
        null,
      );
      await action.saveX();
      expect(mockLog.logs.length).toBeGreaterThanOrEqual(1);
      const lastLog = mockLog.logAt(0);
      expect(lastLog.query).toMatch(/INSERT INTO users/);
      expect(lastLog.values.length).toBe(5);
      // get the last two
      expect(lastLog.values.slice(3)).toStrictEqual(["Jon", "Snow"]);
    });

    test("sensitive", async () => {
      let action = new SimpleAction(
        new LoggedOutViewer(),
        SensitiveValuesSchema,
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
        WriteOperation.Insert,
        null,
      );
      await action.saveX();
      expect(mockLog.logs.length).toBeGreaterThanOrEqual(1);
      const lastLog = mockLog.logAt(0);
      expect(lastLog.query).toMatch(/INSERT INTO sensitive_users/);
      expect(lastLog.values.length).toBe(5);
      // get the last two. Snow replaced with **** since sensitive
      expect(lastLog.values.slice(3)).toStrictEqual(["Jon", "****"]);
    });
  });

  test("defaultValueOnCreate", async () => {
    const builder = new SimpleBuilder(
      new LoggedOutViewer(),
      UserSchema,
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
      WriteOperation.Insert,
      null,
    );
    await builder.saveX();
    const user = await builder.editedEntX();

    const builder2 = new SimpleBuilder(
      new IDViewer(user.id),
      ContactSchema,
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
      WriteOperation.Insert,
      null,
    );

    await builder2.saveX();
    const contact = await builder2.editedEntX();
    expect(contact.data.user_id).toEqual(user.id);

    const builder3 = new SimpleBuilder(
      new LoggedOutViewer(),
      ContactSchema,
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
      WriteOperation.Insert,
      null,
    );
    // logged out viewer with null viewer throws since it's still required
    try {
      await builder3.saveX();
      throw new Error("should have thrown");
    } catch (e) {
      expect(e.message).toBe("field UserID set to null for non-nullable field");
    }
  });

  test("defaultToViewerOnCreate", async () => {
    const builder = new SimpleBuilder(
      new LoggedOutViewer(),
      UserSchema,
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
      WriteOperation.Insert,
      null,
    );
    await builder.saveX();
    const user = await builder.editedEntX();

    const builder2 = new SimpleBuilder(
      new IDViewer(user.id),
      ContactSchema2,
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
      WriteOperation.Insert,
      null,
    );

    await builder2.saveX();
    const contact = await builder2.editedEntX();
    expect(contact.data.user_id).toEqual(user.id);

    const builder3 = new SimpleBuilder(
      new LoggedOutViewer(),
      ContactSchema2,
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
      WriteOperation.Insert,
      null,
    );
    // logged out viewer with null viewer throws since it's still required
    try {
      await builder3.saveX();
      throw new Error("should have thrown");
    } catch (e) {
      expect(e.message).toBe("field UserID set to null for non-nullable field");
    }
  });

  test("edited data", async () => {
    const user = await createUser(
      new Map([
        ["FirstName", "Arya"],
        ["LastName", "Stark"],
      ]),
    );

    const action = new SimpleAction(
      new IDViewer(user.id),
      ContactSchema,
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
      WriteOperation.Insert,
      null,
    );
    action.getTriggers = () => [
      {
        changeset: async (builder: SimpleBuilder<Contact>) => {
          const emailIDs: string[] = [];

          const changesets = await Promise.all(
            [1, 2, 3].map(async (v) => {
              const action2 = new SimpleAction(
                builder.viewer,
                ContactEmailSchema,
                new Map<string, any>([
                  ["contactId", builder],
                  ["email", `foo${v}@bar.com`],
                ]),
                WriteOperation.Insert,
                null,
              );
              const data = await action2.builder.orchestrator.getEditedData();
              emailIDs.push(data.id);
              return action2.changeset();
            }),
          );
          builder.updateInput({ email_ids: emailIDs });

          return changesets;
        },
      },
    ];

    const contact = await action.saveX();
    const emails = convertList(contact.data.email_ids);
    expect(emails.length).toBe(3);
    // id gotten in trigger ends up being saved and references what we expect it to.
    const rows = await loadRows({
      tableName: "contact_emails",
      fields: ["id", "contact_id"],
      clause: clause.In("id", ...emails),
    });
    expect(rows.length).toBe(3);
    expect(rows.every((row) => row.contact_id === contact.id)).toBe(true);
  });

  test("getPossibleUnsafeEntForPrivacy", async () => {
    const user = await createUser(
      new Map([
        ["FirstName", "Arya"],
        ["LastName", "Stark"],
      ]),
    );

    const action = new SimpleAction(
      new IDViewer(user.id),
      ContactSchema3,
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
      WriteOperation.Insert,
      null,
    );
    const unsafe =
      await action.builder.orchestrator.getPossibleUnsafeEntForPrivacy();
    expect(unsafe).toBeDefined();

    const contact = await action.saveX();
    // id gotte from getPossibleUnsafeEntForPrivacy is still returned here
    expect(contact.id).toBe(unsafe?.id);
  });

  test("edited data in trigger id unique", async () => {
    const user = await createUser(
      new Map([
        ["FirstName", "Arya"],
        ["LastName", "Stark"],
      ]),
    );

    const action = new SimpleAction(
      new IDViewer(user.id),
      ContactSchema3,
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
      WriteOperation.Insert,
      null,
    );

    let idInTrigger: string | undefined;
    action.getTriggers = () => [
      {
        changeset: async (builder: SimpleBuilder<Contact>) => {
          const edited = await builder.orchestrator.getEditedData();
          idInTrigger = edited.id;
        },
      },
    ];

    const contact = await action.saveX();
    // explicit test that id gotten in trigger is still returned here
    expect(contact.id).toBe(idInTrigger);
  });
}

const getCreateBuilder = (map: Map<string, any>) => {
  return new SimpleBuilder(
    new LoggedOutViewer(),
    UserSchema,
    map,
    WriteOperation.Insert,
    null,
  );
};

const createUser = async (map: Map<string, any>): Promise<User> => {
  const builder = getCreateBuilder(map);

  //  const
  await builder.saveX();
  return builder.editedEntX();
};

function validateFieldsExist(fields: {}, ...names: string[]) {
  for (const name of names) {
    expect(fields[name], `field ${name}`).not.toBe(undefined);
  }
}

function validateFieldsDoNotExist(fields: {}, ...names: string[]) {
  for (const name of names) {
    expect(fields[name], `field ${name}`).toBe(undefined);
  }
}

function getOperations(c: Changeset): DataOperation[] {
  let ops: DataOperation[] = [];
  for (let op of c.executor()) {
    ops.push(op);
  }
  return ops;
}

async function getFieldsFromBuilder<T extends Ent>(
  builder: Builder<T>,
  expLength: number = 1,
): Promise<Data> {
  const c = await builder.build();
  const ops = getOperations(c);
  expect(ops.length).toBe(expLength);
  for (const op of ops) {
    const options = (op as EditNodeOperation<T>).options;
    if (options !== undefined) {
      return options.fields;
    }
  }
  throw new Error(
    "couldn't find EditNodeOperation where fields are being edited",
  );
}

let sendEmailObserver: Observer<User, SimpleBuilder<User>> = {
  observe: (builder): void => {
    let email = builder.fields.get("EmailAddress");
    if (!email) {
      return;
    }
    let firstName = builder.fields.get("FirstName");
    FakeComms.send({
      from: "noreply@foo.com",
      to: email,
      subject: `Welcome, ${firstName}!`,
      body: `Hi ${firstName}, thanks for joining fun app!`,
      mode: Mode.EMAIL,
    });
  },
};

let sendEmailObserverAsync: Observer<User, SimpleBuilder<User>> = {
  observe: async (builder) => {
    let email = builder.fields.get("EmailAddress");
    if (!email) {
      return;
    }
    let firstName = builder.fields.get("FirstName");
    await FakeComms.sendAsync({
      from: "noreply@foo.com",
      to: email,
      subject: `Welcome, ${firstName}!`,
      body: `Hi ${firstName}, thanks for joining fun app!`,
      mode: Mode.EMAIL,
    });
  },
};
