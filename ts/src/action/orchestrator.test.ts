import { advanceTo } from "jest-date-mock";
import {
  Builder,
  WriteOperation,
  Trigger,
  Validator,
  Observer,
} from "../action";
import { Ent, Viewer, ID, Data, PrivacyPolicy } from "../core/base";
import {
  EditNodeOperation,
  DeleteNodeOperation,
  DataOperation,
  EdgeOperation,
  loadEdges,
  loadRow,
} from "../core/ent";
import { LoggedOutViewer, IDViewer } from "../core/viewer";
import { Changeset } from "../action";
import { StringType, TimestampType, UUIDType } from "../schema/field";
import { JSONBType } from "../schema/json_field";
import { BaseEntSchema, Field } from "../schema";
import {
  User,
  Event,
  Contact,
  Address,
  SimpleBuilder,
  SimpleAction,
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
} from "../core/privacy";
import { edgeDirection } from "./orchestrator";
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
} from "../testutils/db/test_db";
import { Dialect } from "../core/db";

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
      new UserSchema(),
      new UserSchemaWithStatus(),
      new UserSchemaExtended(),
      new UserSchemaServerDefault(),
      new UserSchemaDefaultValueOnCreate(),
      new UserSchemaDefaultValueOnCreateJSON(),
      new UserSchemaDefaultValueOnCreateInvalidJSON(),
      new SchemaWithProcessors(),
      new EventSchema(),
      new AddressSchemaDerivedFields(),
      new ContactSchema(),
      new CustomUserSchema(),
      new SensitiveValuesSchema(),
    ].map((s) => tables.push(getSchemaTable(s, Dialect.SQLite)));
    return tables;
  };

  setupSqlite(`sqlite:///orchestrator-test.db`, getTables);
  commonTests();
});

class UserSchema extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
  ];
  ent = User;
}

class UserWithStatus extends User {}
class UserSchemaWithStatus extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
    // let's assume this was hidden from the generated action and has to be set by the builder...
    StringType({ name: "account_status" }),
  ];
  ent = UserWithStatus;
}

class UserExtended extends User {}

class UserSchemaExtended extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
    StringType({ name: "account_status" }),
    StringType({ name: "EmailAddress", nullable: true }),
  ];
  ent = UserExtended;
}

class UserServerDefault extends User {}

class UserSchemaServerDefault extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
    StringType({ name: "account_status", serverDefault: "ACTIVE" }),
  ];
  ent = UserServerDefault;
}

class UserSchemaDefaultValueOnCreate extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
    StringType({
      name: "account_status",
      defaultValueOnCreate: () => "ACTIVE",
    }),
  ];
  ent = UserServerDefault;
}

class UserDefaultValueOnCreate extends User {}

class UserSchemaDefaultValueOnCreateJSON extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
    JSONBType({
      name: "data",
      defaultValueOnCreate: () => ({}),
    }),
  ];
  ent = UserDefaultValueOnCreate;
}

class UserSchemaDefaultValueOnCreateInvalidJSON extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
    JSONBType({
      name: "data",
      defaultValueOnCreate: () => {},
    }),
  ];
  ent = UserDefaultValueOnCreate;
}

class UserWithProcessors extends User {}
class SchemaWithProcessors extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "zip" }).match(/^\d{5}(-\d{4})?$/),
    StringType({ name: "username" }).toLowerCase(),
  ];
  ent = UserWithProcessors;
}

class AddressSchemaDerivedFields extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "Street" }),
    StringType({ name: "City" }),
    StringType({ name: "State" }),
    StringType({ name: "ZipCode" }),
    StringType({ name: "Apartment", nullable: true }),
    UUIDType({
      name: "OwnerID",
      index: true,
      polymorphic: true,
    }),
  ];
  ent = Address;
}

class EventSchema extends BaseEntSchema {
  fields: Field[] = [
    TimestampType({ name: "startTime" }),
    TimestampType({ name: "endTime" }),
  ];
  ent = Event;
}

class ContactSchema extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
    StringType({
      name: "UserID",
      defaultValueOnCreate: (builder) => builder.viewer.viewerID,
    }),
  ];
  ent = Contact;
}

class ContactSchema2 extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
    StringType({
      name: "UserID",
      defaultToViewerOnCreate: true,
    }),
  ];
  ent = Contact;
}

class CustomUser implements Ent {
  id: ID;
  accountID: string = "";
  nodeType = "User";
  privacyPolicy: PrivacyPolicy = {
    rules: [AllowIfViewerRule, AlwaysDenyRule],
  };
  constructor(public viewer: Viewer, public data: Data) {
    this.id = data.id;
  }
}

class CustomUserSchema extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
  ];
  ent = CustomUser;
}

class SensitiveUser extends User {}
class SensitiveValuesSchema extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName", sensitive: true }),
  ];
  ent = SensitiveUser;
}

function commonTests() {
  test("schema on create", async () => {
    const builder = new SimpleBuilder(
      new LoggedOutViewer(),
      new UserSchema(),
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
    const builder = new SimpleBuilder(
      new LoggedOutViewer(),
      new UserSchema(),
      new Map([
        ["FirstName", "Jon"],
        // non-nullable field set to null
        // simulating what the generated builder will do
        ["LastName", null],
      ]),
    );

    try {
      await builder.build();
      fail("should have thrown exception");
    } catch (e) {
      expect(e.message).toBe(
        "field LastName set to null for non-nullable field",
      );
    }
  });

  // if somehow builder logic doesn't handle this, we still catch this for create
  // should this be default and simplify builders?
  test("required field not set", async () => {
    const builder = new SimpleBuilder(
      new LoggedOutViewer(),
      new UserSchema(),
      new Map([["FirstName", "Jon"]]),
    );

    try {
      await builder.build();
      fail("should have thrown exception");
    } catch (e) {
      expect(e.message).toBe("required field LastName not set");
    }
  });

  test("required field fine when server default exists", async () => {
    const builder = new SimpleBuilder(
      new LoggedOutViewer(),
      new UserSchemaServerDefault(),
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
    );

    await builder.build();
  });

  test("required field fine when default value on create exists", async () => {
    const builder = new SimpleBuilder(
      new LoggedOutViewer(),
      new UserSchemaDefaultValueOnCreate(),
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
    );

    await builder.build();
  });

  test("required field fine when default value on create json ", async () => {
    const builder = new SimpleBuilder(
      new LoggedOutViewer(),
      new UserSchemaDefaultValueOnCreateJSON(),
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
    );

    await builder.build();
  });

  test("required field when default value on create json wrong", async () => {
    const builder = new SimpleBuilder(
      new LoggedOutViewer(),
      new UserSchemaDefaultValueOnCreateInvalidJSON(),
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
    );

    try {
      await builder.build();
      fail("should have thrown");
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
      new UserSchema(),
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
      new UserSchema(),
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
    class SchemaWithNullFields extends BaseEntSchema {
      fields: Field[] = [
        TimestampType({ name: "startTime" }),
        TimestampType({ name: "endTime", nullable: true }),
      ];
      ent = User;
    }

    const d = new Date();
    const builder = new SimpleBuilder(
      new LoggedOutViewer(),
      new SchemaWithNullFields(),
      new Map([["startTime", d]]),
    );

    const fields = await getFieldsFromBuilder(builder);
    expect(fields["start_time"]).toBeDefined();
    expect(fields["start_time"]).toEqual(d.toISOString());
    validateFieldsExist(fields, "id", "created_at", "updated_at");
    validateFieldsDoNotExist(fields, "end_time");

    const builder2 = new SimpleBuilder(
      new LoggedOutViewer(),
      new SchemaWithNullFields(),
      new Map([
        ["startTime", d],
        ["endTime", null],
      ]),
    );
    const fields2 = await getFieldsFromBuilder(builder2);
    expect(fields2["start_time"]).toBeDefined();
    expect(fields2["start_time"]).toEqual(d.toISOString());

    validateFieldsExist(fields2, "id", "created_at", "updated_at");
  });

  test("schema_with_overriden_storage_key", async () => {
    class SchemaWithOverridenDBKey extends BaseEntSchema {
      fields: Field[] = [
        StringType({ name: "emailAddress", storageKey: "email" }),
      ];
      ent = User;
    }

    const builder = new SimpleBuilder(
      new LoggedOutViewer(),
      new SchemaWithOverridenDBKey(),
      new Map([["emailAddress", "test@email.com"]]),
    );

    const fields = await getFieldsFromBuilder(builder);
    expect(fields["email"]).toBe("test@email.com");
    validateFieldsExist(fields, "id", "created_at", "updated_at");
  });

  describe("schema_with_processors", () => {
    test("simple case", async () => {
      const builder = new SimpleBuilder(
        new LoggedOutViewer(),
        new SchemaWithProcessors(),
        new Map([
          ["username", "lolopinto"],
          ["zip", "94114"],
        ]),
      );

      const fields = await getFieldsFromBuilder(builder);
      expect(fields["username"]).toBe("lolopinto");
      expect(fields["zip"]).toBe("94114");
      validateFieldsExist(fields, "id", "created_at", "updated_at");
    });

    test("username lowered", async () => {
      const builder = new SimpleBuilder(
        new LoggedOutViewer(),
        new SchemaWithProcessors(),
        new Map([
          ["username", "LOLOPINTO"],
          ["zip", "94114"],
        ]),
      );

      const fields = await getFieldsFromBuilder(builder);
      expect(fields["username"]).toBe("lolopinto");
      expect(fields["zip"]).toBe("94114");
      validateFieldsExist(fields, "id", "created_at", "updated_at");
    });

    test("invalid zip", async () => {
      const builder = new SimpleBuilder(
        new LoggedOutViewer(),
        new SchemaWithProcessors(),
        new Map([
          ["username", "LOLOPINTO"],
          ["zip", "941"],
        ]),
      );

      try {
        await builder.build();
        fail("should not have gotten here");
      } catch (e) {
        expect(e.message).toBe("invalid field zip with value 941");
      }
    });
  });

  describe("inbound edge", () => {
    test("no options", async () => {
      const builder = getLoggedInBuilder();
      builder.orchestrator.addInboundEdge("2", "edge", "User");

      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.inboundEdge,
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      const edgeOp = await getEdgeOpFromBuilder(builder, 3, "edge");
      expect(edgeOp.edgeInput).toStrictEqual({
        id1: "2",
        id1Type: "User",
        edgeType: "edge",
        id2: "1",
        id2Type: "User",
      });
    });

    test("no id. creating. no options", async () => {
      const builder = getCreateBuilder(
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
      );
      builder.orchestrator.addInboundEdge("2", "edge", "User");

      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.inboundEdge,
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      const edgeOp = await getEdgeOpFromBuilder(builder, 3, "edge");
      expect(edgeOp.edgeInput).toStrictEqual({
        id1: "2",
        id1Type: "User",
        edgeType: "edge",
        id2: builder.placeholderID,
        id2Type: "",
      });
    });

    test("no options then add options", async () => {
      const builder = getLoggedInBuilder();
      builder.orchestrator.addInboundEdge("2", "edge", "User");

      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.inboundEdge,
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      builder.orchestrator.addInboundEdge("2", "edge", "User", {
        data: "123456",
      });
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.inboundEdge,
            options: {
              data: "123456",
            },
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      const edgeOp = await getEdgeOpFromBuilder(builder, 3, "edge");
      expect(edgeOp.edgeInput).toStrictEqual({
        id1: "2",
        id1Type: "User",
        edgeType: "edge",
        id2: "1",
        id2Type: "User",
        data: "123456",
      });
    });

    test("no id. creating. no options, then add options", async () => {
      const builder = getCreateBuilder(
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
      );
      builder.orchestrator.addInboundEdge("2", "edge", "User");

      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.inboundEdge,
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      builder.orchestrator.addInboundEdge("2", "edge", "User", {
        data: "123456",
      });
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.inboundEdge,
            options: {
              data: "123456",
            },
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      const edgeOp = await getEdgeOpFromBuilder(builder, 3, "edge");
      expect(edgeOp.edgeInput).toStrictEqual({
        id1: "2",
        id1Type: "User",
        edgeType: "edge",
        id2: builder.placeholderID,
        id2Type: "",
        data: "123456",
      });
    });

    test("options then diff options", async () => {
      const builder = getLoggedInBuilder();
      builder.orchestrator.addInboundEdge("2", "edge", "User", {
        data: "123456",
      });

      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.inboundEdge,
            options: {
              data: "123456",
            },
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      let date = new Date();
      builder.orchestrator.addInboundEdge("2", "edge", "User", {
        data: "123456",
        time: date,
      });
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.inboundEdge,
            options: {
              data: "123456",
              time: date,
            },
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      const edgeOp = await getEdgeOpFromBuilder(builder, 3, "edge");
      expect(edgeOp.edgeInput).toStrictEqual({
        id1: "2",
        id1Type: "User",
        edgeType: "edge",
        id2: "1",
        id2Type: "User",
        data: "123456",
        time: date,
      });
    });

    test("no id. creating. options, then diff options", async () => {
      const builder = getCreateBuilder(
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
      );
      builder.orchestrator.addInboundEdge("2", "edge", "User", {
        data: "123456",
      });

      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.inboundEdge,
            options: {
              data: "123456",
            },
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      // NOTE: data wasn't set in re-adding so it's removed...
      let date = new Date();
      builder.orchestrator.addInboundEdge("2", "edge", "User", {
        time: date,
      });
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.inboundEdge,
            options: {
              time: date,
            },
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      const edgeOp = await getEdgeOpFromBuilder(builder, 3, "edge");
      expect(edgeOp.edgeInput).toStrictEqual({
        id1: "2",
        id1Type: "User",
        edgeType: "edge",
        id2: builder.placeholderID,
        id2Type: "",
        time: date,
      });
    });

    test("id in data field with placeholder", async () => {
      // create user1
      const user = await createUser(
        new Map([
          ["FirstName", "Arya"],
          ["LastName", "Stark"],
        ]),
      );

      const action = new SimpleAction(
        new LoggedOutViewer(),
        new UserSchema(),
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
        WriteOperation.Insert,
      );
      action.builder.orchestrator.addInboundEdge(user.id, "edge", "User");
      action.triggers = [
        {
          changeset: (builder: SimpleBuilder<User>) => {
            const derivedAction = new SimpleAction(
              new LoggedOutViewer(),
              new UserSchema(),
              new Map([
                ["FirstName", "Sansa"],
                ["LastName", "Stark"],
              ]),
              WriteOperation.Insert,
            );

            // take the edges and write it as 3 edge
            const edges = builder.orchestrator.getInputEdges(
              "edge",
              WriteOperation.Insert,
            );
            edges.forEach((edge) => {
              builder.orchestrator.addInboundEdge(
                edge.id,
                edge.edgeType,
                edge.nodeType!,
                {
                  data: derivedAction.builder,
                },
              );
            });

            return derivedAction.changeset();
          },
        },
      ];

      const newUser = await action.saveX();
      expect(newUser).toBeInstanceOf(User);
      if (!newUser) {
        fail("impossible");
      }

      const edges = await loadEdges({
        id1: user.id,
        edgeType: "edge",
      });
      expect(edges.length).toBe(1);
      const edge = edges[0];
      expect(edge.id1).toBe(user.id);
      expect(edge.id2).toBe(newUser.id);
      expect(edge.data).not.toBeNull();

      // we were able to resolve the id correctly and then set it as needed
      const sansaData = await loadRow({
        tableName: "users",
        fields: ["first_name", "last_name"],
        clause: clause.Eq("id", edge.data),
      });
      expect(sansaData).toBeDefined();
      expect(sansaData?.first_name).toBe("Sansa");
      expect(sansaData?.last_name).toBe("Stark");

      const inverseEdges = await loadEdges({
        id1: newUser.id,
        edgeType: "inverseEdge",
      });
      expect(inverseEdges.length).toBe(1);
      expect(inverseEdges[0].data).toBe(edge.data);
    });

    test("id in data field symmetric edge", async () => {
      // create user1
      const user = await createUser(
        new Map([
          ["FirstName", "Arya"],
          ["LastName", "Stark"],
        ]),
      );

      const action = new SimpleAction(
        new LoggedOutViewer(),
        new UserSchema(),
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
        WriteOperation.Insert,
      );
      action.builder.orchestrator.addInboundEdge(
        user.id,
        "symmetricEdge",
        "User",
      );
      action.triggers = [
        {
          changeset: (builder: SimpleBuilder<User>) => {
            const derivedAction = new SimpleAction(
              new LoggedOutViewer(),
              new UserSchema(),
              new Map([
                ["FirstName", "Sansa"],
                ["LastName", "Stark"],
              ]),
              WriteOperation.Insert,
            );

            // take the edges and write it as 3 edge
            const edges = builder.orchestrator.getInputEdges(
              "symmetricEdge",
              WriteOperation.Insert,
            );
            edges.forEach((edge) => {
              builder.orchestrator.addInboundEdge(
                edge.id,
                edge.edgeType,
                edge.nodeType!,
                {
                  data: derivedAction.builder,
                },
              );
            });

            return derivedAction.changeset();
          },
        },
      ];

      const newUser = await action.saveX();
      expect(newUser).toBeInstanceOf(User);
      if (!newUser) {
        fail("impossible");
      }

      const edges = await loadEdges({
        id1: user.id,
        edgeType: "symmetricEdge",
      });
      expect(edges.length).toBe(1);
      const edge = edges[0];
      expect(edge.id1).toBe(user.id);
      expect(edge.id2).toBe(newUser.id);
      expect(edge.data).not.toBeNull();

      // we were able to resolve the id correctly and then set it as needed
      const sansaData = await loadRow({
        tableName: "users",
        fields: ["first_name", "last_name"],
        clause: clause.Eq("id", edge.data),
      });
      expect(sansaData).toBeDefined();
      expect(sansaData?.first_name).toBe("Sansa");
      expect(sansaData?.last_name).toBe("Stark");

      const inverseEdges = await loadEdges({
        id1: newUser.id,
        edgeType: "symmetricEdge",
      });
      expect(inverseEdges.length).toBe(1);
      expect(inverseEdges[0].data).toBe(edge.data);
    });
  });

  describe("outbound edge", () => {
    test("no options", async () => {
      const builder = getLoggedInBuilder();
      builder.orchestrator.addOutboundEdge("2", "edge", "User");

      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.outboundEdge,
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      // 3 ops, edit, outbound, inverse
      const edgeOp = await getEdgeOpFromBuilder(builder, 3, "edge");
      expect(edgeOp.edgeInput).toStrictEqual({
        id1: "1",
        id1Type: "User",
        edgeType: "edge",
        id2: "2",
        id2Type: "User",
      });
    });

    test("no id. creating. no options", async () => {
      const builder = getCreateBuilder(
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
      );
      builder.orchestrator.addOutboundEdge("2", "edge", "User");

      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.outboundEdge,
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      // 3 ops, create, outbound, inverse
      const edgeOp = await getEdgeOpFromBuilder(builder, 3, "edge");
      expect(edgeOp.edgeInput).toStrictEqual({
        id1: builder.placeholderID,
        id1Type: "",
        id2: "2",
        id2Type: "User",
        edgeType: "edge",
      });
    });

    test("no options then add options", async () => {
      const builder = getLoggedInBuilder();
      builder.orchestrator.addOutboundEdge("2", "edge", "User");

      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.outboundEdge,
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      builder.orchestrator.addOutboundEdge("2", "edge", "User", {
        data: "123456",
      });
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.outboundEdge,
            options: {
              data: "123456",
            },
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      const edgeOp = await getEdgeOpFromBuilder(builder, 3, "edge");
      expect(edgeOp.edgeInput).toStrictEqual({
        id1: "1",
        id1Type: "User",
        edgeType: "edge",
        id2: "2",
        id2Type: "User",
        data: "123456",
      });
    });

    test("no id. creating. no options, then add options", async () => {
      const builder = getCreateBuilder(
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
      );
      builder.orchestrator.addOutboundEdge("2", "edge", "User");

      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.outboundEdge,
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      builder.orchestrator.addOutboundEdge("2", "edge", "User", {
        data: "123456",
      });
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.outboundEdge,
            options: {
              data: "123456",
            },
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      // 3 ops, edit, outbound, inverse
      const edgeOp = await getEdgeOpFromBuilder(builder, 3, "edge");
      expect(edgeOp.edgeInput).toStrictEqual({
        id2: "2",
        id2Type: "User",
        edgeType: "edge",
        id1: builder.placeholderID,
        id1Type: "",
        data: "123456",
      });
    });

    test("options then diff options", async () => {
      const builder = getLoggedInBuilder();
      builder.orchestrator.addOutboundEdge("2", "edge", "User", {
        data: "123456",
      });

      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.outboundEdge,
            options: {
              data: "123456",
            },
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      let date = new Date();
      builder.orchestrator.addOutboundEdge("2", "edge", "User", {
        data: "123456",
        time: date,
      });
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.outboundEdge,
            options: {
              data: "123456",
              time: date,
            },
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      // 3 ops, edit, outbound, inverse
      const edgeOp = await getEdgeOpFromBuilder(builder, 3, "edge");
      expect(edgeOp.edgeInput).toStrictEqual({
        id1: "1",
        id1Type: "User",
        edgeType: "edge",
        id2: "2",
        id2Type: "User",
        data: "123456",
        time: date,
      });
    });

    test("no id. creating. options, then diff options", async () => {
      const builder = getCreateBuilder(
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
      );
      builder.orchestrator.addOutboundEdge("2", "edge", "User", {
        data: "123456",
      });

      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.outboundEdge,
            options: {
              data: "123456",
            },
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      // NOTE: data wasn't set in re-adding so it's removed...
      let date = new Date();
      builder.orchestrator.addOutboundEdge("2", "edge", "User", {
        time: date,
      });
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.outboundEdge,
            options: {
              time: date,
            },
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      // 3 ops, edit, outbound, inverse
      const edgeOp = await getEdgeOpFromBuilder(builder, 3, "edge");
      expect(edgeOp.edgeInput).toStrictEqual({
        id2: "2",
        id2Type: "User",
        edgeType: "edge",
        id1: builder.placeholderID,
        id1Type: "",
        time: date,
      });
    });

    test("id in data field with placeholder", async () => {
      // create user1
      const user = await createUser(
        new Map([
          ["FirstName", "Arya"],
          ["LastName", "Stark"],
        ]),
      );

      const action = new SimpleAction(
        new LoggedOutViewer(),
        new UserSchema(),
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
        WriteOperation.Insert,
      );
      action.builder.orchestrator.addOutboundEdge(user.id, "edge", "User");
      action.triggers = [
        {
          changeset: (builder: SimpleBuilder<User>) => {
            const derivedAction = new SimpleAction(
              new LoggedOutViewer(),
              new UserSchema(),
              new Map([
                ["FirstName", "Sansa"],
                ["LastName", "Stark"],
              ]),
              WriteOperation.Insert,
            );

            // take the edges and write it as 3 edge
            const edges = builder.orchestrator.getInputEdges(
              "edge",
              WriteOperation.Insert,
            );
            edges.forEach((edge) => {
              builder.orchestrator.addOutboundEdge(
                edge.id,
                edge.edgeType,
                edge.nodeType!,
                {
                  data: derivedAction.builder,
                },
              );
            });

            return derivedAction.changeset();
          },
        },
      ];

      const newUser = await action.saveX();
      expect(newUser).toBeInstanceOf(User);
      if (!newUser) {
        fail("impossible");
      }

      const edges = await loadEdges({
        id1: newUser.id,
        edgeType: "edge",
      });
      expect(edges.length).toBe(1);
      const edge = edges[0];
      expect(edge.id1).toBe(newUser.id);
      expect(edge.id2).toBe(user.id);
      expect(edge.data).toBeDefined();

      // we were able to resolve the id correctly and then set it as needed
      const sansaData = await loadRow({
        tableName: "users",
        fields: ["first_name", "last_name"],
        clause: clause.Eq("id", edge.data),
      });
      expect(sansaData).not.toBeNull();
      expect(sansaData?.first_name).toBe("Sansa");
      expect(sansaData?.last_name).toBe("Stark");

      // load inverse
      const inverseEdges = await loadEdges({
        id1: user.id,
        edgeType: "inverseEdge",
      });
      expect(inverseEdges.length).toBe(1);
      const inverseEdge = inverseEdges[0];
      expect(inverseEdge.data).toBe(edge.data);
    });
  });

  test("id in data field symmetric edge", async () => {
    const user = await createUser(
      new Map([
        ["FirstName", "Arya"],
        ["LastName", "Stark"],
      ]),
    );

    const action = new SimpleAction(
      new LoggedOutViewer(),
      new UserSchema(),
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
      WriteOperation.Insert,
    );
    action.builder.orchestrator.addOutboundEdge(
      user.id,
      "symmetricEdge",
      "User",
    );
    action.triggers = [
      {
        changeset: (builder: SimpleBuilder<User>) => {
          const derivedAction = new SimpleAction(
            new LoggedOutViewer(),
            new UserSchema(),
            new Map([
              ["FirstName", "Sansa"],
              ["LastName", "Stark"],
            ]),
            WriteOperation.Insert,
          );

          // take the edges and write it as 3 edge
          const edges = builder.orchestrator.getInputEdges(
            "symmetricEdge",
            WriteOperation.Insert,
          );
          edges.forEach((edge) => {
            builder.orchestrator.addOutboundEdge(
              edge.id,
              edge.edgeType,
              edge.nodeType!,
              {
                data: derivedAction.builder,
              },
            );
          });

          return derivedAction.changeset();
        },
      },
    ];

    const newUser = await action.saveX();
    expect(newUser).toBeInstanceOf(User);
    if (!newUser) {
      fail("impossible");
    }

    const edges = await loadEdges({
      id1: user.id,
      edgeType: "symmetricEdge",
    });
    expect(edges.length).toBe(1);
    const edge = edges[0];
    expect(edge.id1).toBe(user.id);
    expect(edge.id2).toBe(newUser.id);
    expect(edge.data).not.toBeNull();

    // we were able to resolve the id correctly and then set it as needed
    const sansaData = await loadRow({
      tableName: "users",
      fields: ["first_name", "last_name"],
      clause: clause.Eq("id", edge.data),
    });
    expect(sansaData).toBeDefined();
    expect(sansaData?.first_name).toBe("Sansa");
    expect(sansaData?.last_name).toBe("Stark");

    const inverseEdges = await loadEdges({
      id1: newUser.id,
      edgeType: "symmetricEdge",
    });
    expect(inverseEdges.length).toBe(1);
    expect(inverseEdges[0].data).toBe(edge.data);
  });

  test("multi-ids then take and add to other edge", async () => {
    const builder = getLoggedInBuilder();
    let ids = ["2", "3", "4", "5", "6", "7", "8", "9", "10"];
    let expEdges: any[] = [];
    let otherExpEdges: any[] = [];

    ids.forEach((id) => {
      builder.orchestrator.addOutboundEdge(id, "edge", "User");
      expEdges.push(
        expect.objectContaining({
          id: id,
          edgeType: "edge",
          nodeType: "User",
          direction: edgeDirection.outboundEdge,
        }),
      );

      otherExpEdges.push(
        expect.objectContaining({
          id: id,
          edgeType: "otherEdge",
          nodeType: "User",
          direction: edgeDirection.outboundEdge,
        }),
      );
    });

    let edges = builder.orchestrator.getInputEdges(
      "edge",
      WriteOperation.Insert,
    );
    expect(edges).toEqual(expect.arrayContaining(expEdges));

    expect(
      builder.orchestrator.getInputEdges("otherEdge", WriteOperation.Insert),
    ).toEqual([]);

    edges.forEach((edge) => {
      builder.orchestrator.addOutboundEdge(
        edge.id,
        "otherEdge",
        edge.nodeType!,
      );
    });

    expect(
      builder.orchestrator.getInputEdges("otherEdge", WriteOperation.Insert),
    ).toEqual(expect.arrayContaining(otherExpEdges));

    // clears all the edges
    builder.orchestrator.clearInputEdges("edge", WriteOperation.Insert);
    expect(
      builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
    ).toEqual([]);

    // clear just one id "3"
    ids = ids.filter((id) => id != "3");
    builder.orchestrator.clearInputEdges(
      "otherEdge",
      WriteOperation.Insert,
      "3",
    );
    otherExpEdges = [];
    ids.forEach((id) => {
      otherExpEdges.push(
        expect.objectContaining({
          id: id,
          edgeType: "otherEdge",
          nodeType: "User",
          direction: edgeDirection.outboundEdge,
        }),
      );
    });
    expect(
      builder.orchestrator.getInputEdges("otherEdge", WriteOperation.Insert),
    ).toEqual(otherExpEdges);
  });

  describe("remove inbound edge", () => {
    test("existing ent", async () => {
      const viewer = new IDViewer("1");
      const user = new User(viewer, { id: "1" });
      const builder = new SimpleBuilder(
        viewer,
        new UserSchema(),
        new Map(),
        WriteOperation.Edit,
        user, // TODO enforce existing ent if not create
      );
      builder.orchestrator.removeInboundEdge("2", "edge");

      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            direction: edgeDirection.inboundEdge,
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual([]);

      const edgeOp = await getEdgeOpFromBuilder(builder, 3, "edge");
      expect(edgeOp.edgeInput).toStrictEqual({
        id1: "2",
        edgeType: "edge",
        id2: "1",
        id1Type: "", // not useful so we don't care
        id2Type: "",
      });
    });

    test("no ent", async () => {
      const builder = new SimpleBuilder(
        new LoggedOutViewer(),
        new UserSchema(),
        new Map(),
        WriteOperation.Edit,
      );
      builder.orchestrator.removeInboundEdge("2", "edge");

      try {
        await builder.build();

        fail("should not get here");
      } catch (e) {
        expect(e.message).toBe("existing ent required with operation");
      }
    });
  });

  describe("remove outbound edge", () => {
    test("existing ent", async () => {
      const viewer = new IDViewer("1");
      const user = new User(viewer, { id: "1" });
      const builder = new SimpleBuilder(
        viewer,
        new UserSchema(),
        new Map(),
        WriteOperation.Edit,
        user, // TODO enforce existing ent if not create
      );
      builder.orchestrator.removeOutboundEdge("2", "edge");
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual([]);

      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            direction: edgeDirection.outboundEdge,
          }),
        ]),
      );

      const edgeOp = await getEdgeOpFromBuilder(builder, 3, "edge");
      expect(edgeOp.edgeInput).toStrictEqual({
        id1: "1",
        edgeType: "edge",
        id2: "2",
        id1Type: "", // not useful so we don't care
        id2Type: "",
      });
    });

    test("no ent", async () => {
      const builder = new SimpleBuilder(
        new LoggedOutViewer(),
        new UserSchema(),
        new Map(),
        WriteOperation.Edit,
      );
      builder.orchestrator.removeOutboundEdge("2", "edge");

      try {
        await builder.build();
        fail("should not get here");
      } catch (e) {
        expect(e.message).toBe("existing ent required with operation");
      }
    });
  });

  describe("validators", () => {
    const validators: Validator<Event>[] = [
      {
        validate: async (builder: SimpleBuilder<Event>): Promise<void> => {
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

    test("invalid", async () => {
      let now = new Date();
      let yesterday = new Date(now.getTime() - 86400);

      let action = new SimpleAction(
        new LoggedOutViewer(),
        new EventSchema(),
        new Map([
          ["startTime", now],
          ["endTime", yesterday],
        ]),
        WriteOperation.Insert,
      );
      action.validators = validators;

      try {
        await action.validX();
        fail("should have thrown exception");
      } catch (e) {
        expect(e.message).toBe("start time cannot be after end time");
      }
    });

    test("valid", async () => {
      let now = new Date();
      let yesterday = new Date(now.getTime() - 86400);

      let action = new SimpleAction(
        new LoggedOutViewer(),
        new EventSchema(),
        new Map([
          ["startTime", yesterday],
          ["endTime", now],
        ]),
        WriteOperation.Insert,
      );
      action.validators = validators;

      await action.validX();

      // can "save" the query!
      await action.saveX();
    });
  });

  describe("privacyPolicy", () => {
    test("valid", async () => {
      let action = new SimpleAction(
        new LoggedOutViewer(),
        new UserSchema(),
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
        WriteOperation.Insert,
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
      const action = new SimpleAction(
        viewer,
        new UserSchema(),
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
        WriteOperation.Insert,
      );
      action.getPrivacyPolicy = () => {
        return {
          rules: [DenyIfLoggedInRule, AlwaysAllowRule],
        };
      };
      let valid = await action.valid();
      expect(valid).toBe(false);
    });

    test("invalidX. create", async () => {
      const viewer = new IDViewer("1");
      const action = new SimpleAction(
        viewer,
        new UserSchema(),
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
        WriteOperation.Insert,
      );
      action.getPrivacyPolicy = () => {
        return {
          rules: [DenyIfLoggedInRule, AlwaysAllowRule],
        };
      };
      try {
        await action.validX();
        fail("should have thrown");
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
        new UserSchema(),
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
        fail("should have thrown");
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
        new UserSchema(),
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
        fail("should have thrown");
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
        new UserSchema(),
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
        fail("should have thrown");
      } catch (e) {
        expect(e.message).toMatch(
          /Logged out Viewer does not have permission to delete User/,
        );
      }
    });

    test("unsafe ent in creation. valid", async () => {
      let action = new SimpleAction(
        new LoggedOutViewer(),
        new UserSchema(),
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
        WriteOperation.Insert,
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
      let action = new SimpleAction(
        new LoggedOutViewer(),
        new UserSchema(),
        new Map([
          ["FirstName", "Sansa"],
          ["LastName", "Snow"],
        ]),
        WriteOperation.Insert,
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
  });

  describe("trigger", () => {
    let now = new Date();

    const accountStatusTrigger = {
      changeset: (builder: SimpleBuilder<UserWithStatus>): void => {
        builder.fields.set("account_status", "VALID");
      },
    };
    const triggers: Trigger<UserWithStatus>[] = [accountStatusTrigger];

    test("update builder", async () => {
      advanceTo(now);
      const viewer = new IDViewer("11");
      const action = new SimpleAction(
        viewer,
        new UserSchemaWithStatus(),
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
        WriteOperation.Insert,
      );

      action.triggers = triggers;
      const user = await action.saveX();
      if (!user) {
        fail("couldn't save user");
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
        new UserSchemaWithStatus(),
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
        WriteOperation.Insert,
      );
      // also create a contact when we create a user
      action.triggers = [
        accountStatusTrigger,
        {
          changeset: (
            builder: SimpleBuilder<UserWithStatus>,
          ): Promise<Changeset<Contact>> => {
            let firstName = builder.fields.get("FirstName");
            let lastName = builder.fields.get("LastName");
            contactAction = new SimpleAction(
              viewer,
              new ContactSchema(),
              new Map([
                ["FirstName", firstName],
                ["LastName", lastName],
                ["UserID", builder],
              ]),
              WriteOperation.Insert,
            );
            return contactAction.changeset();
          },
        },
      ];

      // this returned a Contact not a User
      // this didn't replace the builder
      const user = await action.saveX();
      if (!user) {
        fail("couldn't save user");
      }
      expect(user.data).toEqual({
        id: user.id,
        created_at: now,
        updated_at: now,
        first_name: "Jon",
        last_name: "Snow",
        account_status: "VALID",
      });

      // let's inspect the created contact
      expect(contactAction!).not.toBe(null);
      let contact = await contactAction!.builder.orchestrator.editedEnt();
      if (!contact) {
        fail("couldn't save contact");
      }
      expect(contact.data).toEqual({
        id: contact.id,
        created_at: now,
        updated_at: now,
        first_name: "Jon",
        last_name: "Snow",
        user_id: user.id, // created contact and set the user_id correctly
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
        new UserSchemaExtended(),
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
          ["account_status", "UNVERIFIED"],
        ]),
        WriteOperation.Insert,
      );
      action.observers = [sendEmailObserver];

      const user = await action.saveX();
      if (!user) {
        fail("couldn't save user");
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
        new UserSchemaExtended(),
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
          ["EmailAddress", "foo@email.com"],
          ["account_status", "UNVERIFIED"],
        ]),
        WriteOperation.Insert,
      );
      action.observers = [sendEmailObserver];

      const user = await action.saveX();
      if (!user) {
        fail("couldn't save user");
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
        new UserSchemaExtended(),
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
          ["EmailAddress", "foo@email.com"],
          ["account_status", "UNVERIFIED"],
        ]),
        WriteOperation.Insert,
      );
      action.observers = [sendEmailObserverAsync];

      const user = await action.saveX();
      if (!user) {
        fail("couldn't save user");
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
        new UserSchemaExtended(),
        fields,
        WriteOperation.Insert,
      );
      action.triggers = [
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
      action.validators = [
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
      action.observers = [sendEmailObserver];
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
        fail("couldn't save user");
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
        fail("couldn't save user");
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
        fail("expected error");
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
    const user = new User(new LoggedOutViewer(), { id: "1" });

    const builder = new SimpleBuilder(
      new LoggedOutViewer(),
      new AddressSchemaDerivedFields(),
      new Map([
        ["Street", "1600 Pennsylvania Avenue NW"],
        ["City", "Washington DC"],
        ["State", "DC"],
        ["ZipCode", "20500"],
        ["OwnerID", user.id],
        ["OwnerType", user.nodeType],
      ]),
    );

    const fields = await getFieldsFromBuilder(builder);
    expect(fields["owner_id"]).toBe(user.id);
    expect(fields["owner_type"]).toBe(user.nodeType);
  });

  describe("viewer for ent load", () => {
    async function createUser(): Promise<CustomUser> {
      let action = new SimpleAction(
        new LoggedOutViewer(),
        new CustomUserSchema(),
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
        WriteOperation.Insert,
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
        new CustomUserSchema(),
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
        WriteOperation.Insert,
      );
      try {
        await action.saveX();
        fail("should have thrown exception");
      } catch (e) {
        expect(e.message).toBe("was able to create ent but not load it");
      }
    });

    test("can edit but can't load user", async () => {
      const user = await createUser();
      let action = new SimpleAction(
        new LoggedOutViewer(),
        new CustomUserSchema(),
        new Map([["LastName", "Snow2"]]),
        WriteOperation.Edit,
        user,
      );
      try {
        await action.saveX();
        fail("should have thrown exception");
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
        new CustomUserSchema(),
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
      setLogLevels("query");
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
        new UserSchema(),
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
        WriteOperation.Insert,
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
        new SensitiveValuesSchema(),
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
        WriteOperation.Insert,
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
      new UserSchema(),
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
    );
    await builder.saveX();
    const user = await builder.editedEntX();

    const builder2 = new SimpleBuilder(
      new IDViewer(user.id),
      new ContactSchema(),
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
    );

    await builder2.saveX();
    const contact = await builder2.editedEntX();
    expect(contact.data.user_id).toEqual(user.id);

    const builder3 = new SimpleBuilder(
      new LoggedOutViewer(),
      new ContactSchema(),
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
    );
    // logged out viewer with null viewer throws since it's still required
    try {
      await builder3.saveX();
      fail("should have thrown");
    } catch (e) {
      expect(e.message).toBe("field UserID set to null for non-nullable field");
    }
  });

  test("defaultToViewerOnCreate", async () => {
    const builder = new SimpleBuilder(
      new LoggedOutViewer(),
      new UserSchema(),
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
    );
    await builder.saveX();
    const user = await builder.editedEntX();

    const builder2 = new SimpleBuilder(
      new IDViewer(user.id),
      new ContactSchema2(),
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
    );

    await builder2.saveX();
    const contact = await builder2.editedEntX();
    expect(contact.data.user_id).toEqual(user.id);

    const builder3 = new SimpleBuilder(
      new LoggedOutViewer(),
      new ContactSchema2(),
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
    );
    // logged out viewer with null viewer throws since it's still required
    try {
      await builder3.saveX();
      fail("should have thrown");
    } catch (e) {
      expect(e.message).toBe("field UserID set to null for non-nullable field");
    }
  });
}
const getLoggedInBuilder = () => {
  const viewer = new IDViewer("1");
  const user = new User(viewer, { id: "1" });
  return new SimpleBuilder(
    viewer,
    new UserSchema(),
    new Map(),
    WriteOperation.Edit,
    user, // TODO enforce existing ent if not create
  );
};

const getCreateBuilder = (map: Map<string, any>) => {
  return new SimpleBuilder(
    new LoggedOutViewer(),
    new UserSchema(),
    map,
    WriteOperation.Insert,
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

function getOperations<T extends Ent>(c: Changeset<T>): DataOperation[] {
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
    const options = (op as EditNodeOperation).options;
    if (options !== undefined) {
      return options.fields;
    }
  }
  fail("couldn't find EditNodeOperation where fields are being edited");
}

async function getEdgeOpFromBuilder<T extends Ent>(
  builder: Builder<T>,
  expLength: number,
  edgeType: string,
): Promise<EdgeOperation> {
  const c = await builder.build();
  const ops = getOperations(c);
  expect(ops.length).toBe(expLength);
  //  console.log(ops);
  for (const op of ops) {
    if ((op as EdgeOperation).edgeInput !== undefined) {
      //      console.log(op);
      // todo add more things to differentiate this by
      const edgeOp = (op as EdgeOperation)!;
      if (edgeOp.edgeInput.edgeType === edgeType) {
        return edgeOp;
      }
    }
  }
  fail(`could not find edge operation with edgeType ${edgeType}`);
}

let sendEmailObserver: Observer<User> = {
  observe: (builder: SimpleBuilder<User>): void => {
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

let sendEmailObserverAsync: Observer<User> = {
  observe: async (builder: SimpleBuilder<User>) => {
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
