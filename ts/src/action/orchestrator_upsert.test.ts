import { Observer, WriteOperation } from "../action";
import { Ent } from "../core/base";
import { loadEdges, loadRow } from "../core/ent";
import { buildQuery } from "../core/query_impl";
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
  getDbFields,
} from "../testutils/builder";
import { FakeComms, Mode } from "../testutils/fake_comms";
import { createRowForTest } from "../testutils/write";
import * as clause from "../core/clause";
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
import { ConstraintType, SQLStatementOperation } from "../schema";
import { randomEmail } from "../testutils/db/value";
import DB, { Dialect } from "../core/db";
import { toDBColumnOrTable } from "../names/names";

const edges = ["edge", "inverseEdge", "symmetricEdge", "uniqueEdge"];
beforeEach(async () => {
  // does assoc_edge_config loader need to be cleared?
  for (const edge of edges) {
    await createRowForTest({
      tableName: "assoc_edge_config",
      fields: {
        edge_table: toDBColumnOrTable(edge, "table"),
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
        toDBColumnOrTable(edge, "table"),
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
  setupSqlite(`sqlite:///orchestrator-upsert-test.db`, getTables);
  commonTests();
});

function commonTests() {
  let ml = new MockLogs();

  let observerCalled = 0;

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
    observerCalled = 0;
  });

  const updateObserverCalledObserver = {
    observe: (builder): void => {
      observerCalled++;
    },
  };

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

      dep.getObservers = () => [updateObserverCalledObserver];

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

      dep.getObservers = () => [updateObserverCalledObserver];

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

  test.each(
    [WriteOperation.Insert, WriteOperation.Edit, WriteOperation.Delete].flatMap(
      (operation) =>
        [false, true].flatMap((conflict) =>
          [false, true].map((update) => ({ operation, conflict, update })),
        ),
    ),
  )("$operation to insert conditional descendants (conflict=$conflict, update=$update)", async ({
    operation,
    conflict,
    update,
  }) => {
    const original = await createUserAction(randomEmail()).saveX();
    const childOriginal = await createUserAction(randomEmail()).saveX();
    const email = randomEmail();
    const target = conflict ? await createUserAction(email).saveX() : null;
    const action = new SimpleAction(
      new LoggedOutViewer(),
      UserSchemaExtended,
      new Map([
        ["FirstName", "Replacement"],
        ["LastName", "Snow"],
        ["account_status", "UNVERIFIED"],
        ["EmailAddress", email],
      ]),
      operation,
      operation === WriteOperation.Insert ? null : original,
    );
    const child = new SimpleAction(
      new LoggedOutViewer(),
      UserSchemaExtended,
      new Map([
        ["FirstName", "Child"],
        ["LastName", "Snow"],
        ["account_status", "UNVERIFIED"],
        ["EmailAddress", randomEmail()],
      ]),
      WriteOperation.Edit,
      childOriginal,
    );
    for (const transformed of [action, child]) {
      Object.assign(transformed, {
        transformWrite: () => ({ op: SQLStatementOperation.Insert }),
      });
    }
    const grandchild = createUserAction(randomEmail());
    const observe = jest.fn();
    for (const dependent of [action, child, grandchild]) {
      dependent.getObservers = () => [{ observe }];
    }
    const conditionalChild = (
      parent: SimpleAction<User>,
      dependent: SimpleAction<User>,
    ) => ({
      async changeset() {
        parent.builder.orchestrator.addOutboundEdge(
          dependent.builder,
          "uniqueEdge",
          "User",
          { conditional: true },
        );
        return dependent.changesetWithOptions_BETA({
          conditionalBuilder: parent.builder,
        });
      },
    });
    action.getTriggers = () => [conditionalChild(action, child)];
    child.getTriggers = () => [conditionalChild(child, grandchild)];
    action.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
      updateCols: update ? ["first_name"] : undefined,
    });
    const saved = await action.saveX();
    expect(await action.builder.orchestrator.getEntID()).toBe(saved.id);
    expect(action.builder.operation).toBe(operation);
    expect(child.builder.operation).toBe(WriteOperation.Edit);
    expect(saved.data.first_name).toBe(
      conflict && !update ? "Jon" : "Replacement",
    );
    const edges = await loadEdges({ id1: saved.id, edgeType: "uniqueEdge" });
    if (conflict) {
      expect(saved.id).toBe(target!.id);
      expect(edges).toEqual([]);
      await verifySchemaCount(UserSchemaExtended, 3);
      expect(observe).not.toHaveBeenCalled();
    } else {
      expect(saved.id).not.toBe(original.id);
      const createdChild = await child.editedEntX();
      const createdGrandchild = await grandchild.editedEntX();
      expect(createdChild.id).not.toBe(childOriginal.id);
      expect(edges.map((edge) => edge.id2)).toEqual([createdChild.id]);
      expect(
        (await loadEdges({ id1: createdChild.id, edgeType: "uniqueEdge" })).map(
          (edge) => edge.id2,
        ),
      ).toEqual([createdGrandchild.id]);
      await verifySchemaCount(UserSchemaExtended, 5);
      expect(observe).toHaveBeenCalledTimes(3);
    }
  });

  test.each(
    [false, true].flatMap((transform) =>
      [false, true].flatMap((conflict) =>
        [false, true].map((update) => ({ transform, conflict, update })),
      ),
    ),
  )("conditional delete and descendants (transform=$transform, conflict=$conflict, update=$update)", async ({
    transform,
    conflict,
    update,
  }) => {
    const victim = await createUserAction(randomEmail()).saveX();
    const endpoint = await createUserAction(randomEmail()).saveX();
    const seed = new SimpleAction(
      victim.viewer,
      UserSchemaExtended,
      new Map(),
      WriteOperation.Edit,
      victim,
    );
    seed.builder.orchestrator.addOutboundEdge(endpoint.id, "edge", "User");
    await seed.saveX();
    const email = randomEmail();
    if (conflict) {
      await createUserAction(email).saveX();
    }
    const parent = createUserAction(email);
    parent.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
      updateCols: update ? ["first_name"] : undefined,
    });
    const child = new SimpleAction(
      victim.viewer,
      UserSchemaExtended,
      new Map(),
      WriteOperation.Delete,
      victim,
    );
    if (transform) {
      Object.assign(child, {
        transformWrite: () => ({ op: SQLStatementOperation.Delete }),
      });
    }
    child.builder.orchestrator.removeOutboundEdge(endpoint.id, "edge");
    const grandchildEmail = randomEmail();
    const grandchild = createUserAction(grandchildEmail);
    grandchild.builder.orchestrator.addOutboundEdge(
      endpoint.id,
      "edge",
      "User",
    );
    const observe = jest.fn();
    for (const action of [parent, child, grandchild]) {
      action.getObservers = () => [{ observe }];
    }
    parent.getTriggers = () => [
      {
        changeset: () =>
          child.changesetWithOptions_BETA({
            conditionalBuilder: parent.builder,
          }),
      },
    ];
    child.getTriggers = () => [
      {
        changeset: () =>
          grandchild.changesetWithOptions_BETA({
            conditionalBuilder: child.builder,
          }),
      },
    ];
    await parent.saveX();
    const original = await loadRow({
      tableName: "user_extendeds",
      fields: ["*"],
      clause: clause.Eq("id", victim.id),
    });
    const nested = await loadRow({
      tableName: "user_extendeds",
      fields: ["*"],
      clause: clause.Eq("email_address", grandchildEmail),
    });
    const originalEdges = await loadEdges({ id1: victim.id, edgeType: "edge" });
    if (conflict) {
      expect(original?.id).toBe(victim.id);
      expect(nested).toBeNull();
      expect(originalEdges.map((edge) => edge.id2)).toEqual([endpoint.id]);
      expect(observe).not.toHaveBeenCalled();
    } else {
      expect(original).toBeNull();
      expect(nested).not.toBeNull();
      expect(originalEdges).toEqual([]);
      expect(
        (await loadEdges({ id1: nested!.id, edgeType: "edge" })).map(
          (edge) => edge.id2,
        ),
      ).toEqual([endpoint.id]);
      expect(observe).toHaveBeenCalledTimes(3);
    }
  });

  test("fresh validation resets a transformed upsert's result ID", async () => {
    const original = await createUserAction(randomEmail()).saveX();
    const email = randomEmail();
    const target = await createUserAction(email).saveX();
    const action = new SimpleAction(
      new LoggedOutViewer(),
      UserSchemaExtended,
      new Map([
        ["FirstName", "Replacement"],
        ["LastName", "Snow"],
        ["account_status", "UNVERIFIED"],
        ["EmailAddress", email],
      ]),
      WriteOperation.Edit,
      original,
    );
    Object.assign(action, {
      transformWrite: () => ({ op: SQLStatementOperation.Insert }),
    });
    action.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
    });
    expect(await action.builder.orchestrator.getEntID()).toBe(original.id);
    await action.validX();
    const proposedID = await action.builder.orchestrator.getEntID();
    expect([original.id, target.id]).not.toContain(proposedID);
    expect((await action.saveX()).id).toBe(target.id);
    expect(await action.builder.orchestrator.getEntID()).toBe(target.id);
    await action.validX();
    expect(await action.builder.orchestrator.getEntID()).toBe(proposedID);
    expect(action.builder.orchestrator.getExistingEntForWrite()).toBeNull();
    expect((await action.saveX()).id).toBe(target.id);
    expect(await action.builder.orchestrator.getEntID()).toBe(target.id);
  });

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
        fields: getDbFields(UserSchemaExtended),
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

    try {
      await Promise.all([action1.saveX(), action2.saveX()]);
      throw new Error("should have thrown");
    } catch (err) {
      expect((err as Error).message).toMatch(/unique_edge_table/);
    }

    // the 1 upsert and the 1 user created in the successful trigger which committed
    await verifySchemaCount(UserSchemaExtended, 2);
  });

  const sendEmailObserver: Observer<User, SimpleBuilder<User>> = {
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

  test("do nothing. with trigger with conditional conflicting edge + observer run once", async () => {
    const email = randomEmail();

    const action1 = createUserAction(email);
    action1.getTriggers = () => [addConditionalEdgeTrigger];
    action1.getObservers = () => [sendEmailObserver];

    action1.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
    });

    const action2 = createUserAction(email);
    action2.getTriggers = () => [addConditionalEdgeTrigger];
    action2.getObservers = () => [sendEmailObserver];
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
        fields: getDbFields(UserSchemaExtended),
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

    const comms = FakeComms.getSent(email, Mode.EMAIL);
    expect(comms.length).toBe(1);
  });

  test("do nothing. with trigger with conditional conflicting edge + conditional changeset + observer run once", async () => {
    const email = randomEmail();

    const action1 = createUserAction(email);
    action1.getTriggers = () => [addConditionalEdgePlusChangesetTrigger];
    action1.getObservers = () => [sendEmailObserver];

    action1.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
    });

    const action2 = createUserAction(email);
    action2.getTriggers = () => [addConditionalEdgePlusChangesetTrigger];
    action2.getObservers = () => [sendEmailObserver];
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
        fields: getDbFields(UserSchemaExtended),
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
    const comms = FakeComms.getSent(email, Mode.EMAIL);
    expect(comms.length).toBe(1);
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
          fields: getDbFields(UserSchemaExtended),
          clause: clause.Eq("email_address", email),
        }),
        values: [email],
      });
    }
  });

  test("update. with trigger with conflicting edge + observer run once", async () => {
    const email = randomEmail();

    const action1 = createUserAction(email);
    action1.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
      updateCols: ["updated_at"],
    });
    action1.getTriggers = () => [addEdgeTrigger];
    action1.getObservers = () => [sendEmailObserver];

    const action2 = createUserAction(email);
    action2.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
      updateCols: ["updated_at"],
    });
    action2.getTriggers = () => [addEdgeTrigger];
    action2.getObservers = () => [sendEmailObserver];

    try {
      await Promise.all([action1.saveX(), action2.saveX()]);
      throw new Error("should have thrown");
    } catch (err) {
      expect((err as Error).message).toMatch(/unique_edge_table/);
    }

    // the 1 upsert and the 1 user created in the successful trigger which committed
    await verifySchemaCount(UserSchemaExtended, 2);

    const comms = FakeComms.getSent(email, Mode.EMAIL);
    expect(comms.length).toBe(1);
  });

  test("update. with trigger with conditional conflicting edge + observer run once", async () => {
    const email = randomEmail();

    const action1 = createUserAction(email);
    action1.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
      updateCols: ["updated_at"],
    });
    action1.getTriggers = () => [addConditionalEdgeTrigger];
    action1.getObservers = () => [sendEmailObserver];

    const action2 = createUserAction(email);
    action2.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
      updateCols: ["updated_at"],
    });
    action2.getTriggers = () => [addConditionalEdgeTrigger];
    action2.getObservers = () => [sendEmailObserver];

    const [u1, u2] = await Promise.all([action1.saveX(), action2.saveX()]);
    expect(u1.id).toBe(u2.id);
    expect(u1.data.email_address).toBe(u2.data.email_address);
    // updated time should be different since there was a conflict and it updated
    expect(u1.data.updated_at).not.toBe(u2.data.updated_at);

    const select = ml.logs.filter((ml) => ml.query.startsWith("SELECT"));

    if (DB.getDialect() === Dialect.Postgres) {
      // TODO come back. we're querying for edges now but previously weren;t?
      // that's confusing
      // console.debug(select);
      // expect(select.length).toBe(0);
      expect(select).not.toContainEqual({
        query: buildQuery({
          tableName: "user_extendeds",
          fields: getDbFields(UserSchemaExtended),
          clause: clause.Eq("email_address", email),
        }),
        values: [email],
      });
    } else {
      // for sqlite, we still do this query
      expect(select).toContainEqual({
        query: buildQuery({
          tableName: "user_extendeds",
          fields: getDbFields(UserSchemaExtended),
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

    const comms = FakeComms.getSent(email, Mode.EMAIL);
    expect(comms.length).toBe(1);
  });

  test("update. with trigger with conditional conflicting edge + conditional changeset + observer run once", async () => {
    const email = randomEmail();

    const action1 = createUserAction(email);
    action1.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
      updateCols: ["updated_at"],
    });
    action1.getTriggers = () => [addConditionalEdgePlusChangesetTrigger];
    action1.getObservers = () => [sendEmailObserver];

    const action2 = createUserAction(email);
    action2.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
      updateCols: ["updated_at"],
    });
    action2.getTriggers = () => [addConditionalEdgePlusChangesetTrigger];
    action2.getObservers = () => [sendEmailObserver];

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
          fields: getDbFields(UserSchemaExtended),
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
    const comms = FakeComms.getSent(email, Mode.EMAIL);
    expect(comms.length).toBe(1);
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
        fields: getDbFields(UserSchemaMultipleUnique),
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
          fields: getDbFields(UserSchemaMultipleUnique),
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
          fields: getDbFields(UserSchemaMultipleUnique),
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
    action1.getObservers = () => [sendEmailObserver];

    action1.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
    });

    const action2 = createUserAction(email);
    action2.getTriggers = () => [
      addConditionalEdgeWithExplicitDependencyPlusChangesetTrigger,
    ];
    action2.getObservers = () => [sendEmailObserver];
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
        fields: getDbFields(UserSchemaExtended),
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

    // email only sent once
    const comms = FakeComms.getSent(email, Mode.EMAIL);
    expect(comms.length).toBe(1);

    // dependent observer only called once
    expect(observerCalled).toBe(1);
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
    action1.getObservers = () => [sendEmailObserver];

    action1.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
    });

    const action2 = createUserAction(email);

    action2.getTriggers = () => [addEventTrigger];
    action2.getObservers = () => [sendEmailObserver];
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
      fields: getDbFields(EventSchema),
      clause: clause.Eq("owner_id", u1.id),
    });
    if (!event_row) {
      throw new Error("event row not found");
    }

    const address_row = await loadRow({
      tableName: getTableName(AddressSchema),
      fields: getDbFields(AddressSchema),
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

    // email only sent once
    const comms = FakeComms.getSent(email, Mode.EMAIL);
    expect(comms.length).toBe(1);

    // dependent observer only called once
    expect(observerCalled).toBe(1);
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
    action1.getObservers = () => [sendEmailObserver];

    action1.builder.orchestrator.setOnConflictOptions({
      onConflictCols: ["email_address"],
    });

    const action2 = createUserAction(email);

    action2.getTriggers = () => [addEventTrigger];
    action2.getObservers = () => [sendEmailObserver];
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
      fields: getDbFields(EventSchema),
      clause: clause.Eq("owner_id", u1.id),
    });
    if (!event_row) {
      throw new Error("event row not found");
    }

    const address_row = await loadRow({
      tableName: getTableName(AddressSchema),
      fields: getDbFields(AddressSchema),
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

    // email only sent once
    const comms = FakeComms.getSent(email, Mode.EMAIL);
    expect(comms.length).toBe(1);

    // dependent observer only called once
    expect(observerCalled).toBe(1);
  });
}

async function verifySchemaCount(schema: BuilderSchema<Ent>, ct: number) {
  const tableName = getTableName(schema);
  const r = await DB.getInstance()
    .getPool()
    .queryAll(`select count(*) as count from ${tableName}`);
  expect(parseInt(r.rows[0]["count"])).toBe(ct);
}
