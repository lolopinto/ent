import { advanceTo } from "jest-date-mock";
import { WriteOperation } from "../action";
import { Data, Ent, Viewer } from "../core/base";
import { LoggedOutViewer } from "../core/viewer";
import { StringType, TimestampType } from "../schema/field";
import {
  BaseEntSchema,
  Field,
  Pattern,
  UpdateOperation,
  TransformedUpdateOperation,
  SQLStatementOperation,
} from "../schema";
import { User, SimpleAction, Contact } from "../testutils/builder";
import { FakeComms } from "../testutils/fake_comms";
import { Pool } from "pg";
import { QueryRecorder } from "../testutils/db_mock";
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
} from "../testutils/db/test_db";
import { convertDate } from "../core/convert";
import { loadConfig } from "../core/config";
import { FieldMap } from "../schema";

jest.mock("pg");
QueryRecorder.mockPool(Pool);
loadConfig({
  // log: ["query"],
});

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

    [new UserSchema(), new ContactSchema()].map((s) =>
      tables.push(getSchemaTable(s, Dialect.SQLite)),
    );
    return tables;
  };

  setupSqlite(`sqlite:///transformed-orchestrator-test.db`, getTables);
  commonTests();
});

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

class UserSchema extends BaseEntSchema {
  constructor() {
    super();
    this.addPatterns(new DeletedAtPattern());
  }
  fields: FieldMap = {
    FirstName: StringType(),
    LastName: StringType(),
  };
  ent = User;
}

class ContactSchema extends BaseEntSchema {
  constructor() {
    super();
    this.addPatterns(new DeletedAtSnakeCasePattern());
  }
  fields: FieldMap = {
    first_name: StringType(),
    last_name: StringType(),
  };
  ent = Contact;
}

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
  return new SimpleAction(
    viewer,
    new UserSchema(),
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
    new ContactSchema(),
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
      new UserSchema(),
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
      new UserSchema(),
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
    const verifyPostgres = (ct: number) => {
      const users = QueryRecorder.getData().get("users") || [];
      if (DB.getDialect() !== Dialect.Postgres) {
        return;
      }
      expect(users.length).toBe(ct);
    };
    verifyPostgres(0);
    const action = getInsertUserAction(
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
    );
    const user = await action.saveX();
    verifyPostgres(1);

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
    verifyPostgres(1);

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
    verifyPostgres(2);
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
      new ContactSchema(),
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
      new ContactSchema(),
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

  test("insert -> update", async () => {
    const verifyPostgres = (ct: number) => {
      const contacts = QueryRecorder.getData().get("contacts") || [];
      if (DB.getDialect() !== Dialect.Postgres) {
        return;
      }
      expect(contacts.length).toBe(ct);
    };
    verifyPostgres(0);
    const action = getInsertContactAction(
      new Map([
        ["first_name", "Jon"],
        ["last_name", "Snow"],
      ]),
    );
    const contact = await action.saveX();
    verifyPostgres(1);

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
    verifyPostgres(1);

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
    verifyPostgres(2);
  });
}

// TODO trait implemented...
// for deleted etc to check value
