import { WriteOperation } from "../action";
import { Ent } from "../core/base";
import { buildQuery, loadEdges, loadRow } from "../core/ent";
import { LoggedOutViewer, IDViewer } from "../core/viewer";
import { StringType, TimestampType, UUIDType } from "../schema/field";
import {
  User,
  Event,
  Address,
  SimpleBuilder,
  SimpleAction,
  getBuilderSchemaFromFields,
  BuilderSchema,
  getTableName,
} from "../testutils/builder";
import { FakeComms } from "../testutils/fake_comms";
import { createRowForTest } from "../testutils/write";
import * as clause from "../core/clause";
import { snakeCase } from "snake-case";
import { clearLogLevels, setLogLevels } from "../core/logger";

import { MockLogs } from "../testutils/mock_log";
import {
  assoc_edge_config_table,
  assoc_edge_table,
  getSchemaTable,
  setupPostgres,
  setupSqlite,
  Table,
} from "../testutils/db/temp_db";
import { ConstraintType } from "../schema";
import { randomEmail } from "../testutils/db/value";
import DB, { Dialect } from "../core/db";

const edges = ["edge", "inverseEdge", "symmetricEdge", "uniqueEdge"];
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
  FakeComms.clear();
});

class UserExtended extends User {}

const UserSchemaExtended = getBuilderSchemaFromFields(
  {
    FirstName: StringType(),
    LastName: StringType(),
    account_status: StringType(),
    EmailAddress: StringType({ nullable: true, unique: true }),
  },
  UserExtended,
);

class UserMultipleUnique extends User {}

const UserSchemaMultipleUnique = getBuilderSchemaFromFields(
  {
    FirstName: StringType(),
    LastName: StringType(),
    account_status: StringType(),
    EmailAddress: StringType(),
  },
  UserMultipleUnique,
  {
    constraints: [
      {
        name: "email_address_account_status_unique",
        columns: ["email_address", "account_status"],
        type: ConstraintType.Unique,
      },
    ],
  },
);

const AddressSchema = getBuilderSchemaFromFields(
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
    ownerID: UUIDType(),
  },
  Event,
);

const getTables = () => {
  const tables: Table[] = [assoc_edge_config_table()];
  edges.map((edge) =>
    tables.push(
      assoc_edge_table(
        `${snakeCase(edge)}_table`,
        false,
        edge === "uniqueEdge",
      ),
    ),
  );

  [
    UserSchemaExtended,
    UserSchemaMultipleUnique,
    AddressSchema,
    EventSchema,
  ].map((s) => tables.push(getSchemaTable(s, Dialect.SQLite)));
  return tables;
};

describe("postgres", () => {
  setupPostgres(getTables);
  commonTests();
});

describe("sqlite", () => {
  setupSqlite(`sqlite:///orchestrator-test.db`, getTables);
  commonTests();
});

function commonTests() {
  let ml = new MockLogs();

  beforeAll(() => {
    ml.mock();
    setLogLevels(["query", "cache"]);
  });

  afterAll(() => {
    ml.restore();
    clearLogLevels();
  });

  beforeEach(() => {
    ml.clear();
  });

  const createUserAction = (email: string, schema = UserSchemaExtended) =>
    new SimpleAction(
      new LoggedOutViewer(),
      schema,
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
        ["account_status", "UNVERIFIED"],
        ["EmailAddress", email],
      ]),
      WriteOperation.Insert,
      null,
    );

  const addEdgeTrigger = {
    async changeset(builder: SimpleBuilder<any>, input) {
      const dep = createUserAction(randomEmail());

      builder.orchestrator.addOutboundEdge(dep.builder, "uniqueEdge", "User");
      return dep.changeset();
    },
  };

  const addConditionalEdgeTrigger = {
    async changeset(builder: SimpleBuilder<any>, input) {
      const dep = createUserAction(randomEmail());

      // conditional!
      builder.orchestrator.addOutboundEdge(dep.builder, "uniqueEdge", "User", {
        conditional: true,
      });
      return dep.changeset();
    },
  };

  const addConditionalEdgePlusChangesetTrigger = {
    async changeset(builder: SimpleBuilder<any>, input) {
      const dep = createUserAction(randomEmail());

      // conditional edge!
      builder.orchestrator.addOutboundEdge(dep.builder, "uniqueEdge", "User", {
        conditional: true,
      });
      // conditional changeset on builder
      return dep.changesetWithOptions_BETA({
        conditionalBuilder: builder,
      });
    },
  };

  const addConditionalEdgeWithExplicitDependencyPlusChangesetTrigger = {
    async changeset(builder: SimpleBuilder<any>, input) {
      const dep = new SimpleAction(
        new LoggedOutViewer(),
        AddressSchema,
        new Map<string, any>([
          ["Street", "1600 Pennsylvania Avenue NW"],
          ["City", "Washington DC"],
          ["State", "DC"],
          ["ZipCode", "20500"],
          ["OwnerID", builder],
          ["OwnerType", "User"],
        ]),
        WriteOperation.Insert,
        null,
      );

      // conditional edge!
      builder.orchestrator.addOutboundEdge(
        dep.builder,
        "uniqueEdge",
        "Address",
        {
          conditional: true,
        },
      );
      // conditional changeset on builder
      return dep.changesetWithOptions_BETA({
        conditionalBuilder: builder,
      });
    },
  };

  // like addConditionalEdgeWithExplicitDependencyPlusChangesetTrigger but nothing is conditional
  // its parent calling this is conditional
  const addEdgeWithExplicitDependencyPlusChangesetTrigger = {
    async changeset(builder: SimpleBuilder<any>, input) {
      const dep = new SimpleAction(
        new LoggedOutViewer(),
        AddressSchema,
        new Map<string, any>([
          ["Street", "1600 Pennsylvania Avenue NW"],
          ["City", "Washington DC"],
          ["State", "DC"],
          ["ZipCode", "20500"],
          ["OwnerID", builder],
          ["OwnerType", "User"],
        ]),
        WriteOperation.Insert,
        null,
      );

      builder.orchestrator.addOutboundEdge(
        dep.builder,
        "uniqueEdge",
        "Address",
      );
      return dep.changeset();
    },
  };

  const addConditionalChangesetwithCircularDependency = {
    async changeset(builder: SimpleBuilder<any>, input) {
      const action = createUserAction(randomEmail());

      builder.updateInput({
        // this should lead to an error because we're creating a circular dependency
        // since conditional change creates a dependency
        OwnerID: action.builder,
        OwnerType: "User",
      });

      // conditional changeset on builder
      return action.changesetWithOptions_BETA({
        conditionalBuilder: builder,
      });
    },
  };

  test("no upsert. error ", async () => {
    const email = randomEmail();

    const action1 = createUserAction(email);
    const action2 = createUserAction(email);

    try {
      await Promise.all([action1.saveX(), action2.saveX()]);
      throw new Error("should have thrown");
    } catch (err) {
      expect((err as Error).message).toMatch(/unique|UNIQUE/);
    }
  });

  test("do nothing", async () => {
    const email = randomEmail();

    const action1 = createUserAction(email);
    action1.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
    });

    const action2 = createUserAction(email);
    action2.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
    });

    const [u1, u2] = await Promise.all([action1.saveX(), action2.saveX()]);
    expect(u1.id).toBe(u2.id);
    expect(u1.data.email_address).toBe(u2.data.email_address);
    expect(u1.data).toStrictEqual(u2.data);

    const select = ml.logs.filter((ml) => ml.query.startsWith("SELECT"));

    // for sqlite, we're not testing the regular select * from user_extendeds where id = ? query
    expect(select).toContainEqual({
      query: buildQuery({
        tableName: "user_extendeds",
        fields: ["*"],
        clause: clause.Eq("email_address", email),
      }),
      values: [email],
    });
  });

  test("do nothing. with trigger with conflicting edge", async () => {
    const email = randomEmail();

    const action1 = createUserAction(email);
    action1.getTriggers = () => [addEdgeTrigger];

    action1.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
    });

    const action2 = createUserAction(email);
    action2.getTriggers = () => [addEdgeTrigger];
    action2.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
    });

    await expect(
      Promise.all([action1.saveX(), action2.saveX()]),
    ).rejects.toThrowError(/unique_edge_table/);

    // the 1 upsert and the 1 user created in the successful trigger which committed
    await verifySchemaCount(UserSchemaExtended, 2);
  });

  test("do nothing. with trigger with conditional conflicting edge", async () => {
    const email = randomEmail();

    const action1 = createUserAction(email);
    action1.getTriggers = () => [addConditionalEdgeTrigger];

    action1.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
    });

    const action2 = createUserAction(email);
    action2.getTriggers = () => [addConditionalEdgeTrigger];
    action2.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
    });

    const [u1, u2] = await Promise.all([action1.saveX(), action2.saveX()]);
    expect(u1.id).toBe(u2.id);
    expect(u1.data.email_address).toBe(u2.data.email_address);
    expect(u1.data).toStrictEqual(u2.data);

    const select = ml.logs.filter((ml) => ml.query.startsWith("SELECT"));

    // for sqlite, we're not testing the regular select * from user_extendeds where id = ? query
    expect(select).toContainEqual({
      query: buildQuery({
        tableName: "user_extendeds",
        fields: ["*"],
        clause: clause.Eq("email_address", email),
      }),
      values: [email],
    });

    const edges = await loadEdges({
      id1: u1.id,
      edgeType: "uniqueEdge",
    });
    expect(edges.length).toBe(1);

    // the 1 upsert and the 2 users created in each trigger
    await verifySchemaCount(UserSchemaExtended, 3);
  });

  test("do nothing. with trigger with conditional conflicting edge + conditional changeset", async () => {
    const email = randomEmail();

    const action1 = createUserAction(email);
    action1.getTriggers = () => [addConditionalEdgePlusChangesetTrigger];

    action1.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
    });

    const action2 = createUserAction(email);
    action2.getTriggers = () => [addConditionalEdgePlusChangesetTrigger];
    action2.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
    });

    const [u1, u2] = await Promise.all([action1.saveX(), action2.saveX()]);
    expect(u1.id).toBe(u2.id);
    expect(u1.data.email_address).toBe(u2.data.email_address);
    expect(u1.data).toStrictEqual(u2.data);

    const select = ml.logs.filter((ml) => ml.query.startsWith("SELECT"));

    // for sqlite, we're not testing the regular select * from user_extendeds where id = ? query
    expect(select).toContainEqual({
      query: buildQuery({
        tableName: "user_extendeds",
        fields: ["*"],
        clause: clause.Eq("email_address", email),
      }),
      values: [email],
    });

    const edges = await loadEdges({
      id1: u1.id,
      edgeType: "uniqueEdge",
    });
    expect(edges.length).toBe(1);

    // the 1 upsert and the 1 user created in the successful trigger.
    // conditional changeset doesn't create user again
    await verifySchemaCount(UserSchemaExtended, 2);
  });

  test("update", async () => {
    const email = randomEmail();

    const action1 = createUserAction(email);
    action1.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
      updateCols: ["updated_at"],
    });

    const action2 = createUserAction(email);
    action2.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
      updateCols: ["updated_at"],
    });

    const [u1, u2] = await Promise.all([action1.saveX(), action2.saveX()]);
    expect(u1.id).toBe(u2.id);
    expect(u1.data.email_address).toBe(u2.data.email_address);
    // updated time should be different since there was a conflict and it updated
    expect(u1.data.updated_at).not.toBe(u2.data.updated_at);

    const select = ml.logs.filter((ml) => ml.query.startsWith("SELECT"));

    if (DB.getDialect() === Dialect.Postgres) {
      expect(select.length).toBe(0);
    } else {
      // for sqlite, we still do this query
      expect(select).toContainEqual({
        query: buildQuery({
          tableName: "user_extendeds",
          fields: ["*"],
          clause: clause.Eq("email_address", email),
        }),
        values: [email],
      });
    }
  });

  test("update. with trigger with conflicting edge", async () => {
    const email = randomEmail();

    const action1 = createUserAction(email);
    action1.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
      updateCols: ["updated_at"],
    });
    action1.getTriggers = () => [addEdgeTrigger];

    const action2 = createUserAction(email);
    action2.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
      updateCols: ["updated_at"],
    });
    action2.getTriggers = () => [addEdgeTrigger];

    await expect(
      Promise.all([action1.saveX(), action2.saveX()]),
    ).rejects.toThrowError(/unique_edge_table/);

    // the 1 upsert and the 1 user created in the successful trigger which committed
    await verifySchemaCount(UserSchemaExtended, 2);
  });

  test("update. with trigger with conditional conflicting edge", async () => {
    const email = randomEmail();

    const action1 = createUserAction(email);
    action1.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
      updateCols: ["updated_at"],
    });
    action1.getTriggers = () => [addConditionalEdgeTrigger];

    const action2 = createUserAction(email);
    action2.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
      updateCols: ["updated_at"],
    });
    action2.getTriggers = () => [addConditionalEdgeTrigger];

    const [u1, u2] = await Promise.all([action1.saveX(), action2.saveX()]);
    expect(u1.id).toBe(u2.id);
    expect(u1.data.email_address).toBe(u2.data.email_address);
    // updated time should be different since there was a conflict and it updated
    expect(u1.data.updated_at).not.toBe(u2.data.updated_at);

    const select = ml.logs.filter((ml) => ml.query.startsWith("SELECT"));

    if (DB.getDialect() === Dialect.Postgres) {
      expect(select.length).toBe(0);
    } else {
      // for sqlite, we still do this query
      expect(select).toContainEqual({
        query: buildQuery({
          tableName: "user_extendeds",
          fields: ["*"],
          clause: clause.Eq("email_address", email),
        }),
        values: [email],
      });
    }

    const edges = await loadEdges({
      id1: u1.id,
      edgeType: "uniqueEdge",
    });
    expect(edges.length).toBe(1);

    // the 1 upsert and the 2 users created in each trigger
    await verifySchemaCount(UserSchemaExtended, 3);
  });

  test("update. with trigger with conditional conflicting edge + conditional changeset", async () => {
    const email = randomEmail();

    const action1 = createUserAction(email);
    action1.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
      updateCols: ["updated_at"],
    });
    action1.getTriggers = () => [addConditionalEdgePlusChangesetTrigger];

    const action2 = createUserAction(email);
    action2.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
      updateCols: ["updated_at"],
    });
    action2.getTriggers = () => [addConditionalEdgePlusChangesetTrigger];

    const [u1, u2] = await Promise.all([action1.saveX(), action2.saveX()]);
    expect(u1.id).toBe(u2.id);
    expect(u1.data.email_address).toBe(u2.data.email_address);
    // updated time should be different since there was a conflict and it updated
    expect(u1.data.updated_at).not.toBe(u2.data.updated_at);

    const select = ml.logs.filter((ml) => ml.query.startsWith("SELECT"));

    // in both, we load edge data.
    if (DB.getDialect() !== Dialect.Postgres) {
      // for sqlite, we still do this query
      expect(select).toContainEqual({
        query: buildQuery({
          tableName: "user_extendeds",
          fields: ["*"],
          clause: clause.Eq("email_address", email),
        }),
        values: [email],
      });
    }

    const edges = await loadEdges({
      id1: u1.id,
      edgeType: "uniqueEdge",
    });
    expect(edges.length).toBe(1);

    // the 1 upsert and the 1 user created in the successful trigger.
    // conditional changeset doesn't create user again
    await verifySchemaCount(UserSchemaExtended, 2);
  });

  test("do nothing multiple cols", async () => {
    const email = randomEmail();

    const action1 = createUserAction(email, UserSchemaMultipleUnique);
    action1.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address", "account_status"],
    });

    const action2 = createUserAction(email, UserSchemaMultipleUnique);
    action2.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address", "account_status"],
    });

    const [u1, u2] = await Promise.all([action1.saveX(), action2.saveX()]);
    expect(u1.id).toBe(u2.id);
    expect(u1.data.email_address).toBe(u2.data.email_address);
    expect(u1.data).toStrictEqual(u2.data);

    const select = ml.logs.filter((ml) => ml.query.startsWith("SELECT"));
    expect(select).toContainEqual({
      query: buildQuery({
        tableName: "user_multiple_uniques",
        fields: ["*"],
        clause: clause.And(
          clause.Eq("email_address", email),
          clause.Eq("account_status", "UNVERIFIED"),
        ),
      }),
      values: [email, "UNVERIFIED"],
    });
  });

  test("multiple cols. update", async () => {
    const viewer = new IDViewer("11");

    const email = randomEmail();

    const action1 = createUserAction(email, UserSchemaMultipleUnique);
    action1.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address", "account_status"],
      updateCols: ["updated_at"],
    });

    const action2 = createUserAction(email, UserSchemaMultipleUnique);
    action2.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address", "account_status"],
      updateCols: ["updated_at"],
    });

    const [u1, u2] = await Promise.all([action1.saveX(), action2.saveX()]);
    expect(u1.id).toBe(u2.id);
    expect(u1.data.email_address).toBe(u2.data.email_address);
    expect(u1.data.updated_at).not.toBe(u2.data.updated_at);

    const select = ml.logs.filter((ml) => ml.query.startsWith("SELECT"));

    if (DB.getDialect() === Dialect.Postgres) {
      expect(select.length).toBe(0);
    } else {
      // for sqlite, we still do this query
      expect(select).toContainEqual({
        query: buildQuery({
          tableName: "user_multiple_uniques",
          fields: ["*"],
          clause: clause.And(
            clause.Eq("email_address", email),
            clause.Eq("account_status", "UNVERIFIED"),
          ),
        }),
        values: [email, "UNVERIFIED"],
      });
    }
  });

  test("constraint name. do nothing", async () => {
    if (Dialect.Postgres !== DB.getDialect()) {
      return;
    }

    const email = randomEmail();

    const action1 = createUserAction(email, UserSchemaMultipleUnique);

    try {
      action1.builder.orchestrator.setOnConflictOptions({
        onConflictConstraint: "email_address_account_status_unique",
        onConflictCols: [],
      });
      throw new Error("should not reach here");
    } catch (err) {
      expect((err as Error).message).toBe(
        "cannot set onConflictConstraint without updateCols",
      );
    }
  });

  test("constraint_name. update", async () => {
    if (Dialect.Postgres !== DB.getDialect()) {
      return;
    }

    const email = randomEmail();

    const action1 = createUserAction(email, UserSchemaMultipleUnique);
    action1.builder.orchestrator.setOnConflictOptions({
      onConflictConstraint: "email_address_account_status_unique",
      onConflictCols: [],
      updateCols: ["updated_at"],
    });

    const action2 = createUserAction(email, UserSchemaMultipleUnique);
    action2.builder.orchestrator.setOnConflictOptions({
      onConflictConstraint: "email_address_account_status_unique",
      onConflictCols: [],
      updateCols: ["updated_at"],
    });

    const [u1, u2] = await Promise.all([action1.saveX(), action2.saveX()]);
    expect(u1.id).toBe(u2.id);
    expect(u1.data.email_address).toBe(u2.data.email_address);
    expect(u1.data.updated_at).not.toBe(u2.data.updated_at);

    const select = ml.logs.filter((ml) => ml.query.startsWith("SELECT"));
    if (DB.getDialect() === Dialect.Postgres) {
      expect(select.length).toBe(0);
    } else {
      expect(select).toContainEqual({
        query: buildQuery({
          tableName: "user_multiple_uniques",
          fields: ["*"],
          clause: clause.And(
            clause.Eq("email_address", email),
            clause.Eq("account_status", "UNVERIFIED"),
          ),
        }),
        values: [email, "UNVERIFIED"],
      });
    }
  });

  test("do nothing. with trigger with conditional conflicting edge + conditional changeset with explicit dependencies", async () => {
    const email = randomEmail();

    const action1 = createUserAction(email);
    action1.getTriggers = () => [
      addConditionalEdgeWithExplicitDependencyPlusChangesetTrigger,
    ];

    action1.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
    });

    const action2 = createUserAction(email);
    action2.getTriggers = () => [
      addConditionalEdgeWithExplicitDependencyPlusChangesetTrigger,
    ];
    action2.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
    });

    const [u1, u2] = await Promise.all([action1.saveX(), action2.saveX()]);
    expect(u1.id).toBe(u2.id);
    expect(u1.data.email_address).toBe(u2.data.email_address);
    expect(u1.data).toStrictEqual(u2.data);

    const select = ml.logs.filter((ml) => ml.query.startsWith("SELECT"));

    // for sqlite, we're not testing the regular select * from user_extendeds where id = ? query
    expect(select).toContainEqual({
      query: buildQuery({
        tableName: "user_extendeds",
        fields: ["*"],
        clause: clause.Eq("email_address", email),
      }),
      values: [email],
    });

    const edges = await loadEdges({
      id1: u1.id,
      edgeType: "uniqueEdge",
    });
    expect(edges.length).toBe(1);

    // the 1 upsert and the 1 user created in the successful trigger.
    // conditional changeset doesn't create user again
    await verifySchemaCount(UserSchemaExtended, 1);

    // the 1 upsert and the 1 user created in the successful trigger.
    // conditional changeset doesn't create user again
    await verifySchemaCount(AddressSchema, 1);
  });

  test("do nothing. with trigger with conditional conditional changeset with circular dependencies", async () => {
    const action1 = new SimpleAction(
      new LoggedOutViewer(),
      AddressSchema,
      new Map<string, any>([
        ["Street", "1600 Pennsylvania Avenue NW"],
        ["City", "Washington DC"],
        ["State", "DC"],
        ["ZipCode", "20500"],
      ]),
      WriteOperation.Insert,
      null,
    );
    action1.getTriggers = () => [addConditionalChangesetwithCircularDependency];

    action1.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["state"],
    });

    const action2 = new SimpleAction(
      new LoggedOutViewer(),
      AddressSchema,
      new Map<string, any>([
        ["Street", "1600 Pennsylvania Avenue NW"],
        ["City", "Washington DC"],
        ["State", "DC"],
        ["ZipCode", "20500"],
      ]),
      WriteOperation.Insert,
      null,
    );
    action2.getTriggers = () => [addConditionalChangesetwithCircularDependency];
    action2.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["state"],
    });

    try {
      await Promise.all([action1.saveX(), action2.saveX()]);
      fail("should have thrown");
    } catch (err) {
      // should eventually have a better error message here...
      expect((err as Error).message).toBe("Cycle found");
    }
  });

  test("do nothing. with conditional turtles all the way down", async () => {
    class CreateEventAction extends SimpleAction<Event, null> {
      getTriggers() {
        // nodeType is wrong here but whatever
        return [addConditionalEdgeWithExplicitDependencyPlusChangesetTrigger];
      }
    }

    const addEventTrigger = {
      async changeset(builder: SimpleBuilder<any>, input) {
        const dep = new CreateEventAction(
          new LoggedOutViewer(),
          EventSchema,
          new Map<string, any>([
            ["startTime", new Date()],
            ["endTime", new Date()],
            ["ownerID", builder],
            ["ownerType", "User"],
          ]),
          WriteOperation.Insert,
          null,
        );

        // conditional edge!
        builder.orchestrator.addOutboundEdge(
          dep.builder,
          "uniqueEdge",
          "Address",
          {
            conditional: true,
          },
        );
        // conditional changeset on builder
        return dep.changesetWithOptions_BETA({
          conditionalBuilder: builder,
        });
      },
    };

    const email = randomEmail();
    const action1 = createUserAction(email);

    action1.getTriggers = () => [addEventTrigger];

    action1.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
    });

    const action2 = createUserAction(email);

    action2.getTriggers = () => [addEventTrigger];
    action2.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
    });

    // await action1.saveX();
    const [u1, u2] = await Promise.all([action1.saveX(), action2.saveX()]);
    expect(u1.id).toBe(u2.id);
    expect(u1.data.email_address).toBe(u2.data.email_address);
    expect(u1.data).toStrictEqual(u2.data);

    await verifySchemaCount(UserSchemaExtended, 1);

    await verifySchemaCount(AddressSchema, 1);

    await verifySchemaCount(EventSchema, 1);

    // 1 of each of these created despite being nested
    // and the conditional flows through in an upsert
    const event_row = await loadRow({
      tableName: "events",
      fields: ["*"],
      clause: clause.Eq("owner_id", u1.id),
    });
    if (!event_row) {
      throw new Error("event row not found");
    }

    const address_row = await loadRow({
      tableName: getTableName(AddressSchema),
      fields: ["*"],
      clause: clause.Eq("owner_id", event_row.id),
    });

    if (!address_row) {
      throw new Error("address row not found");
    }

    const edges = await loadEdges({
      id1: event_row.id,
      edgeType: "uniqueEdge",
    });
    expect(edges.length).toBe(1);
    expect(edges[0].id2).toBe(address_row.id);
  });

  test("do nothing. with conditional turtle once. below not conditional all the way down", async () => {
    class CreateEventAction extends SimpleAction<Event, null> {
      getTriggers() {
        // nodeType is wrong here but whatever
        return [addEdgeWithExplicitDependencyPlusChangesetTrigger];
      }
    }

    // creating event is conditional
    // creating address below is not conditional
    const addEventTrigger = {
      async changeset(builder: SimpleBuilder<any>, input) {
        const dep = new CreateEventAction(
          new LoggedOutViewer(),
          EventSchema,
          new Map<string, any>([
            ["startTime", new Date()],
            ["endTime", new Date()],
            ["ownerID", builder],
            ["ownerType", "User"],
          ]),
          WriteOperation.Insert,
          null,
        );

        // conditional edge!
        builder.orchestrator.addOutboundEdge(
          dep.builder,
          "uniqueEdge",
          "Address",
          {
            conditional: true,
          },
        );
        // conditional changeset on builder
        return dep.changesetWithOptions_BETA({
          conditionalBuilder: builder,
        });
      },
    };

    const email = randomEmail();
    const action1 = createUserAction(email);

    action1.getTriggers = () => [addEventTrigger];

    action1.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
    });

    const action2 = createUserAction(email);

    action2.getTriggers = () => [addEventTrigger];
    action2.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
    });

    const [u1, u2] = await Promise.all([action1.saveX(), action2.saveX()]);
    expect(u1.id).toBe(u2.id);
    expect(u1.data.email_address).toBe(u2.data.email_address);
    expect(u1.data).toStrictEqual(u2.data);

    await verifySchemaCount(UserSchemaExtended, 1);

    await verifySchemaCount(EventSchema, 1);

    await verifySchemaCount(AddressSchema, 1);

    // 1 of each of these created despite being nested
    // and the conditional flows through in an upsert
    const event_row = await loadRow({
      tableName: "events",
      fields: ["*"],
      clause: clause.Eq("owner_id", u1.id),
    });
    if (!event_row) {
      throw new Error("event row not found");
    }

    const address_row = await loadRow({
      tableName: getTableName(AddressSchema),
      fields: ["*"],
      clause: clause.Eq("owner_id", event_row.id),
    });

    if (!address_row) {
      throw new Error("address row not found");
    }

    const edges = await loadEdges({
      id1: event_row.id,
      edgeType: "uniqueEdge",
    });
    expect(edges.length).toBe(1);
    expect(edges[0].id2).toBe(address_row.id);
  });
}

async function verifySchemaCount(schema: BuilderSchema<Ent>, ct: number) {
  const tableName = getTableName(schema);
  const r = await DB.getInstance()
    .getPool()
    .queryAll(`select count(*) as count from ${tableName}`);
  expect(parseInt(r.rows[0]["count"])).toBe(ct);
}
