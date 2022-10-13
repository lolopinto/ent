import { advanceTo } from "jest-date-mock";
import { WriteOperation } from "../action";
import { EntChangeset } from "../action/orchestrator";
import { Data, Ent, Viewer } from "../core/base";
import { LoggedOutViewer } from "../core/viewer";
import { StringType, TimestampType } from "../schema/field";
import {
  Pattern,
  UpdateOperation,
  TransformedUpdateOperation,
  SQLStatementOperation,
} from "../schema";
import {
  User,
  SimpleAction,
  Contact,
  EntBuilderSchema,
} from "../testutils/builder";
import { createRowForTest } from "../testutils/write";
import * as clause from "../core/clause";
import { snakeCase } from "snake-case";
import DB, { Dialect } from "../core/db";
import { ObjectLoader } from "../core/loaders";
import { TestContext } from "../testutils/context/test_context";
import {
  assoc_edge_config_table,
  assoc_edge_table,
  getSchemaTable,
  setupSqlite,
  Table,
  TempDB,
} from "../testutils/db/temp_db";
import { convertDate } from "../core/convert";
import { FieldMap } from "../schema";
import { loadRawEdgeCountX, RawQueryOperation } from "../core/ent";

const edges = ["edge", "inverseEdge", "symmetricEdge"];
async function createEdges() {
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
}

class DeletedAtPattern implements Pattern {
  name = "deleted_at";
  fields: FieldMap = {
    // need this to be lowerCamelCase because we do this based on field name
    // #510
    deletedAt: TimestampType({
      nullable: true,
      index: true,
      defaultValueOnCreate: () => null,
    }),
  };

  transformRead(): clause.Clause {
    // this is based on sql. other is based on field
    return clause.Eq("deleted_at", null);
  }

  transformWrite<T extends Ent>(
    stmt: UpdateOperation<T>,
  ): TransformedUpdateOperation<T> | null {
    switch (stmt.op) {
      case SQLStatementOperation.Delete:
        return {
          op: SQLStatementOperation.Update,
          data: {
            // this should return field, it'll be formatted as needed
            deletedAt: new Date(),
          },
        };
    }
    return null;
  }
}

class DeletedAtSnakeCasePattern implements Pattern {
  name = "deleted_at";
  fields: FieldMap = {
    deleted_at: TimestampType({
      nullable: true,
      index: true,
      defaultValueOnCreate: () => null,
    }),
  };

  transformRead(): clause.Clause {
    // this is based on sql. other is based on field
    return clause.Eq("deleted_at", null);
  }

  transformWrite<T extends Ent>(
    stmt: UpdateOperation<T>,
  ): TransformedUpdateOperation<T> | null {
    switch (stmt.op) {
      case SQLStatementOperation.Delete:
        return {
          op: SQLStatementOperation.Update,
          data: {
            // this should return field, it'll be formatted as needed
            deleted_at: new Date(),
          },
        };
    }
    return null;
  }
}

class DeletedAtPatternWithExtraWrites implements Pattern {
  name = "deleted_at";
  fields: FieldMap = {
    // need this to be lowerCamelCase because we do this based on field name
    // #510
    deletedAt: TimestampType({
      nullable: true,
      index: true,
      defaultValueOnCreate: () => null,
    }),
  };

  transformRead(): clause.Clause {
    // this is based on sql. other is based on field
    return clause.Eq("deleted_at", null);
  }

  transformWrite<T extends Ent>(
    stmt: UpdateOperation<T>,
  ): TransformedUpdateOperation<T> | null {
    switch (stmt.op) {
      case SQLStatementOperation.Delete:
        return {
          op: SQLStatementOperation.Update,
          data: {
            // this should return field, it'll be formatted as needed
            deletedAt: new Date(),
          },
          changeset: () =>
            EntChangeset.changesetFrom(stmt.builder, [
              new RawQueryOperation([
                `DELETE FROM edge_table WHERE id1 = '${stmt.builder.existingEnt?.id}'`,
                `DELETE FROM inverse_edge_table WHERE id1 = '${stmt.builder.existingEnt?.id}'`,
                `DELETE FROM symmetric_edge_table WHERE id1 = '${stmt.builder.existingEnt?.id}'`,
                {
                  query: `DELETE FROM edge_table WHERE id2 = ${
                    DB.getDialect() === Dialect.Postgres ? "$1" : "?"
                  }`,
                  values: [stmt.builder.existingEnt?.id],
                },
                {
                  query: `DELETE FROM inverse_edge_table WHERE id2 = ${
                    DB.getDialect() === Dialect.Postgres ? "$1" : "?"
                  }`,
                  values: [stmt.builder.existingEnt?.id],
                },
                {
                  query: `DELETE FROM symmetric_edge_table WHERE id2 = ${
                    DB.getDialect() === Dialect.Postgres ? "$1" : "?"
                  }`,
                  values: [stmt.builder.existingEnt?.id],
                },
              ]),
            ]),
        };
    }
    return null;
  }
}

const UserSchema = new EntBuilderSchema(User, {
  patterns: [new DeletedAtPattern()],

  fields: {
    FirstName: StringType(),
    LastName: StringType(),
  },
});

const ContactSchema = new EntBuilderSchema(Contact, {
  patterns: [new DeletedAtSnakeCasePattern()],

  fields: {
    first_name: StringType(),
    last_name: StringType(),
  },
});

class Account extends User {}

const AccountSchema = new EntBuilderSchema(Account, {
  patterns: [new DeletedAtPatternWithExtraWrites()],

  fields: {
    FirstName: StringType(),
    LastName: StringType(),
  },
});

const getTables = () => {
  const tables: Table[] = [assoc_edge_config_table()];
  edges.map((edge) =>
    tables.push(assoc_edge_table(`${snakeCase(edge)}_table`)),
  );

  [UserSchema, ContactSchema, AccountSchema].map((s) =>
    tables.push(getSchemaTable(s, Dialect.SQLite)),
  );
  return tables;
};

describe("postgres", () => {
  const tdb = new TempDB(Dialect.Postgres, getTables());
  beforeAll(async () => {
    await tdb.beforeAll();
    await createEdges();
  });

  afterAll(async () => {
    await tdb.afterAll();
  });

  beforeEach(async () => {
    await DB.getInstance().getPool().query("DELETE FROM contacts");
    await DB.getInstance().getPool().query("DELETE FROM users");
    await DB.getInstance().getPool().query("DELETE FROM accounts");
  });

  commonTests();
});

describe("sqlite", () => {
  setupSqlite(`sqlite:///transformed-orchestrator-test.db`, getTables);
  beforeEach(async () => {
    await createEdges();
  });

  commonTests();
});

const getNewLoader = (context: boolean = true) => {
  return new ObjectLoader(
    {
      tableName: "users",
      fields: ["id", "first_name", "last_name", "deleted_at"],
      key: "id",
      clause: clause.Eq("deleted_at", null),
    },
    context ? new TestContext() : undefined,
  );
};

const getAccountNewLoader = (context: boolean = true) => {
  return new ObjectLoader(
    {
      tableName: "accounts",
      fields: ["id", "first_name", "last_name", "deleted_at"],
      key: "id",
      clause: clause.Eq("deleted_at", null),
    },
    context ? new TestContext() : undefined,
  );
};

const getContactNewLoader = (context: boolean = true) => {
  return new ObjectLoader(
    {
      tableName: "contacts",
      fields: ["id", "first_name", "last_name", "deleted_at"],
      key: "id",
      clause: clause.Eq("deleted_at", null),
    },
    context ? new TestContext() : undefined,
  );
};

// deleted_at field but no custom_clause
// behavior when we're ignoring deleted_at. exception...
const getNewLoaderNoCustomClause = (context: boolean = true) => {
  return new ObjectLoader(
    {
      tableName: "users",
      fields: ["id", "first_name", "last_name", "deleted_at"],
      key: "id",
    },
    context ? new TestContext() : undefined,
  );
};

const getContactNewLoaderNoCustomClause = (context: boolean = true) => {
  return new ObjectLoader(
    {
      tableName: "contacts",
      fields: ["id", "first_name", "last_name", "deleted_at"],
      key: "id",
    },
    context ? new TestContext() : undefined,
  );
};

const getAccountNewLoaderNoCustomClause = (context: boolean = true) => {
  return new ObjectLoader(
    {
      tableName: "accounts",
      fields: ["id", "first_name", "last_name", "deleted_at"],
      key: "id",
    },
    context ? new TestContext() : undefined,
  );
};

function transformDeletedAt(row: Data | null) {
  if (row === null) {
    return null;
  }
  if (row.deleted_at === null || row.deleted_at === undefined) {
    return row;
  }
  row.deleted_at = convertDate(row.deleted_at);
  return row;
}

function getInsertUserAction(
  map: Map<string, any>,
  viewer: Viewer = new LoggedOutViewer(),
) {
  return new SimpleAction(viewer, UserSchema, map, WriteOperation.Insert, null);
}

function getInsertAccountAction(
  map: Map<string, any>,
  viewer: Viewer = new LoggedOutViewer(),
) {
  return new SimpleAction(
    viewer,
    AccountSchema,
    map,
    WriteOperation.Insert,
    null,
  );
}

function getInsertContactAction(
  map: Map<string, any>,
  viewer: Viewer = new LoggedOutViewer(),
) {
  return new SimpleAction(
    viewer,
    ContactSchema,
    map,
    WriteOperation.Insert,
    null,
  );
}

function commonTests() {
  test("delete -> update", async () => {
    const action = getInsertUserAction(
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
    );
    const user = await action.saveX();
    const loader = getNewLoader();

    const row = await loader.load(user.id);
    expect(row).toEqual({
      id: user.id,
      first_name: "Jon",
      last_name: "Snow",
      deleted_at: null,
    });

    const d = new Date();
    advanceTo(d);
    const action2 = new SimpleAction(
      new LoggedOutViewer(),
      UserSchema,
      new Map(),
      WriteOperation.Delete,
      user,
    );

    await action2.save();

    loader.clearAll();
    const row2 = await loader.load(user.id);
    expect(row2).toBeNull();

    // loader which bypasses transformations
    const loader2 = getNewLoaderNoCustomClause();
    const row3 = await loader2.load(user.id);
    expect(transformDeletedAt(row3)).toEqual({
      id: user.id,
      first_name: "Jon",
      last_name: "Snow",
      deleted_at: d,
    });
  });

  test("delete -> update with extra writes", async () => {
    const action = getInsertAccountAction(
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
    );
    const account1 = await action.saveX();

    const action2 = getInsertAccountAction(
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
    );
    const account2 = await action2.saveX();

    const action3 = getInsertAccountAction(
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
    );
    action3.builder.orchestrator.addOutboundEdge(
      account1.id,
      "symmetricEdge",
      "account",
    );
    action3.builder.orchestrator.addOutboundEdge(
      account2.id,
      "inverseEdge",
      "account",
    );

    action3.builder.orchestrator.addOutboundEdge(
      account1.id,
      "edge",
      "account",
    );

    const account3 = await action3.saveX();
    const loader = getAccountNewLoader();

    const row = await loader.load(account3.id);
    expect(row).toEqual({
      id: account3.id,
      first_name: "Jon",
      last_name: "Snow",
      deleted_at: null,
    });

    const d = new Date();
    advanceTo(d);

    let [edgeCt, inverseEdgeCt, symmetricEdgeCt] = await Promise.all([
      loadRawEdgeCountX({
        id1: account3.id,
        edgeType: "edge",
      }),
      loadRawEdgeCountX({
        id1: account3.id,
        edgeType: "inverseEdge",
      }),
      loadRawEdgeCountX({
        id1: account3.id,
        edgeType: "symmetricEdge",
      }),
    ]);

    expect(edgeCt).toBe(1);
    expect(symmetricEdgeCt).toBe(1);
    expect(inverseEdgeCt).toBe(1);

    const action4 = new SimpleAction(
      new LoggedOutViewer(),
      AccountSchema,
      new Map(),
      WriteOperation.Delete,
      account3,
    );

    await action4.save();

    loader.clearAll();
    const row2 = await loader.load(account3.id);
    expect(row2).toBeNull();

    // loader which bypasses transformations
    const loader2 = getAccountNewLoaderNoCustomClause();
    const row3 = await loader2.load(account3.id);
    expect(transformDeletedAt(row3)).toEqual({
      id: account3.id,
      first_name: "Jon",
      last_name: "Snow",
      deleted_at: d,
    });

    [edgeCt, inverseEdgeCt, symmetricEdgeCt] = await Promise.all([
      loadRawEdgeCountX({
        id1: account3.id,
        edgeType: "edge",
      }),
      loadRawEdgeCountX({
        id1: account3.id,
        edgeType: "inverseEdge",
      }),
      loadRawEdgeCountX({
        id1: account3.id,
        edgeType: "symmetricEdge",
      }),
    ]);

    expect(edgeCt).toBe(0);
    expect(symmetricEdgeCt).toBe(0);
    expect(inverseEdgeCt).toBe(0);
  });

  test("really delete", async () => {
    const action = getInsertUserAction(
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
    );
    const user = await action.saveX();
    const loader = getNewLoader();

    const row = await loader.load(user.id);
    expect(row).toEqual({
      id: user.id,
      first_name: "Jon",
      last_name: "Snow",
      deleted_at: null,
    });

    const action2 = new SimpleAction(
      new LoggedOutViewer(),
      UserSchema,
      new Map(),
      WriteOperation.Delete,
      user,
    );
    action2.builder.orchestrator.setDisableTransformations(true);

    await action2.save();

    loader.clearAll();
    const row2 = await loader.load(user.id);
    expect(row2).toBeNull();

    // loader which bypasses transformations
    const loader2 = getNewLoaderNoCustomClause();
    const row3 = await loader2.load(user.id);
    expect(row3).toBe(null);
  });

  test("insert -> update", async () => {
    const verifyRows = async (ct: number) => {
      // hmm, not sure why this is still needed...
      if (Dialect.Postgres !== DB.getDialect()) {
        return;
      }
      const res = await DB.getInstance()
        .getPool()
        .query("select count(*) as count from users;");
      expect(parseInt(res.rows[0].count)).toBe(ct);
    };

    await verifyRows(0);
    const action = getInsertUserAction(
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
    );
    const user = await action.saveX();
    await verifyRows(1);

    const loader = getNewLoader();

    const row = await loader.load(user.id);
    expect(row).toEqual({
      id: user.id,
      first_name: "Jon",
      last_name: "Snow",
      deleted_at: null,
    });

    const tranformJonToAegon = (
      stmt: UpdateOperation<User>,
    ): TransformedUpdateOperation<User> | undefined => {
      if (stmt.op != SQLStatementOperation.Insert || !stmt.data) {
        return;
      }

      const firstName = stmt.data.get("FirstName");
      const lastName = stmt.data.get("LastName");

      if (firstName == "Aegon" && lastName == "Targaryen") {
        return {
          op: SQLStatementOperation.Update,
          existingEnt: user,
        };
      }
    };

    const action2 = getInsertUserAction(
      new Map([
        ["FirstName", "Aegon"],
        ["LastName", "Targaryen"],
      ]),
    );
    // @ts-ignore
    action2.transformWrite = tranformJonToAegon;

    const user2 = await action2.saveX();
    expect(user.id).toBe(user2.id);
    expect(user2.firstName).toBe("Aegon");
    expect(user2.data.last_name).toBe("Targaryen");
    await verifyRows(1);

    const action3 = getInsertUserAction(
      new Map([
        ["FirstName", "Sansa"],
        ["LastName", "Stark"],
      ]),
    );
    // @ts-ignore
    action3.transformWrite = tranformJonToAegon;

    // new user craeted
    const user3 = await action3.saveX();
    expect(user.id).not.toBe(user3.id);
    expect(user3.firstName).toBe("Sansa");
    expect(user3.data.last_name).toBe("Stark");
    await verifyRows(2);
  });

  test("delete -> update. snake_case", async () => {
    const action = getInsertContactAction(
      new Map([
        ["first_name", "Jon"],
        ["last_name", "Snow"],
      ]),
    );
    const contact = await action.saveX();
    const loader = getContactNewLoader();

    const row = await loader.load(contact.id);
    expect(row).toEqual({
      id: contact.id,
      first_name: "Jon",
      last_name: "Snow",
      deleted_at: null,
    });

    const d = new Date();
    advanceTo(d);
    const action2 = new SimpleAction(
      new LoggedOutViewer(),
      ContactSchema,
      new Map(),
      WriteOperation.Delete,
      contact,
    );

    await action2.save();

    loader.clearAll();
    const row2 = await loader.load(contact.id);
    expect(row2).toBeNull();

    // loader which bypasses transformations
    const loader2 = getContactNewLoaderNoCustomClause();
    const row3 = await loader2.load(contact.id);
    expect(transformDeletedAt(row3)).toEqual({
      id: contact.id,
      first_name: "Jon",
      last_name: "Snow",
      deleted_at: d,
    });
  });

  test("really delete. snake_case", async () => {
    const action = getInsertContactAction(
      new Map([
        ["first_name", "Jon"],
        ["last_name", "Snow"],
      ]),
    );
    const contact = await action.saveX();
    const loader = getContactNewLoader();

    const row = await loader.load(contact.id);
    expect(row).toEqual({
      id: contact.id,
      first_name: "Jon",
      last_name: "Snow",
      deleted_at: null,
    });

    const action2 = new SimpleAction(
      new LoggedOutViewer(),
      ContactSchema,
      new Map(),
      WriteOperation.Delete,
      contact,
    );
    action2.builder.orchestrator.setDisableTransformations(true);

    await action2.save();

    loader.clearAll();
    const row2 = await loader.load(contact.id);
    expect(row2).toBeNull();

    // loader which bypasses transformations
    const loader2 = getContactNewLoaderNoCustomClause();
    const row3 = await loader2.load(contact.id);
    expect(row3).toBe(null);
  });

  test("insert -> update 2", async () => {
    const verifyRows = async (ct: number) => {
      if (Dialect.Postgres !== DB.getDialect()) {
        return;
      }
      const res = await DB.getInstance()
        .getPool()
        .query("select count(1) from contacts;");
      expect(parseInt(res.rows[0].count)).toBe(ct);
    };
    await verifyRows(0);
    const action = getInsertContactAction(
      new Map([
        ["first_name", "Jon"],
        ["last_name", "Snow"],
      ]),
    );
    const contact = await action.saveX();
    await verifyRows(1);

    const loader = getContactNewLoader();

    const row = await loader.load(contact.id);
    expect(row).toEqual({
      id: contact.id,
      first_name: "Jon",
      last_name: "Snow",
      deleted_at: null,
    });

    const tranformJonToAegon = (
      stmt: UpdateOperation<Contact>,
    ): TransformedUpdateOperation<Contact> | undefined => {
      if (stmt.op != SQLStatementOperation.Insert || !stmt.data) {
        return;
      }

      const firstName = stmt.data.get("first_name");
      const lastName = stmt.data.get("last_name");

      if (firstName == "Aegon" && lastName == "Targaryen") {
        return {
          op: SQLStatementOperation.Update,
          existingEnt: contact,
        };
      }
    };

    const action2 = getInsertContactAction(
      new Map([
        ["first_name", "Aegon"],
        ["last_name", "Targaryen"],
      ]),
    );
    // @ts-ignore
    action2.transformWrite = tranformJonToAegon;

    const contact2 = await action2.saveX();
    expect(contact.id).toBe(contact2.id);
    expect(contact2.data.first_name).toBe("Aegon");
    expect(contact2.data.last_name).toBe("Targaryen");
    await verifyRows(1);

    const action3 = getInsertContactAction(
      new Map([
        ["first_name", "Sansa"],
        ["last_name", "Stark"],
      ]),
    );
    // @ts-ignore
    action3.transformWrite = tranformJonToAegon;

    // new contact craeted
    const contact3 = await action3.saveX();
    expect(contact.id).not.toBe(contact3.id);
    expect(contact3.data.first_name).toBe("Sansa");
    expect(contact3.data.last_name).toBe("Stark");
    await verifyRows(2);
  });

  test("insert -> update no existingEnt returned", async () => {
    const verifyRows = async (ct: number) => {
      if (Dialect.Postgres !== DB.getDialect()) {
        return;
      }
      const res = await DB.getInstance()
        .getPool()
        .query("select count(1) from contacts;");
      expect(parseInt(res.rows[0].count)).toBe(ct);
    };
    await verifyRows(0);
    const action = getInsertContactAction(
      new Map([
        ["first_name", "Jon"],
        ["last_name", "Snow"],
      ]),
    );
    const contact = await action.saveX();
    await verifyRows(1);

    const loader = getContactNewLoader();

    const row = await loader.load(contact.id);
    expect(row).toEqual({
      id: contact.id,
      first_name: "Jon",
      last_name: "Snow",
      deleted_at: null,
    });

    const tranformJonToAegon = (
      stmt: UpdateOperation<Contact>,
    ): TransformedUpdateOperation<Contact> | undefined => {
      if (stmt.op != SQLStatementOperation.Insert || !stmt.data) {
        return;
      }

      const firstName = stmt.data.get("first_name");
      const lastName = stmt.data.get("last_name");

      if (firstName == "Aegon" && lastName == "Targaryen") {
        return {
          op: SQLStatementOperation.Update,
        };
      }
    };

    const action2 = getInsertContactAction(
      new Map([
        ["first_name", "Aegon"],
        ["last_name", "Targaryen"],
      ]),
    );
    // @ts-ignore
    action2.transformWrite = tranformJonToAegon;

    await expect(action2.saveX()).rejects.toThrow(
      /cannot transform an insert operation without providing an existing ent/,
    );
  });

  test("throw in transformWrite", async () => {
    const verifyRows = async (ct: number) => {
      if (Dialect.Postgres !== DB.getDialect()) {
        return;
      }
      const res = await DB.getInstance()
        .getPool()
        .query("select count(1) from contacts;");
      expect(parseInt(res.rows[0].count)).toBe(ct);
    };
    await verifyRows(0);
    const action = getInsertContactAction(
      new Map([
        ["first_name", "Jon"],
        ["last_name", "Snow"],
      ]),
    );
    const contact = await action.saveX();
    await verifyRows(1);

    const loader = getContactNewLoader();

    const row = await loader.load(contact.id);
    expect(row).toEqual({
      id: contact.id,
      first_name: "Jon",
      last_name: "Snow",
      deleted_at: null,
    });

    const tranformJonToAegon = (
      stmt: UpdateOperation<Contact>,
    ): TransformedUpdateOperation<Contact> | undefined => {
      throw new Error("test failure");
    };

    const action2 = getInsertContactAction(
      new Map([
        ["first_name", "Aegon"],
        ["last_name", "Targaryen"],
      ]),
    );
    // @ts-ignore
    action2.transformWrite = tranformJonToAegon;

    await expect(action2.saveX()).rejects.toThrow(/test failure/);
  });
}

// TODO trait implemented...
// for deleted etc to check value
