import { v4 as uuidv4 } from "uuid";
import { advanceTo } from "jest-date-mock";
import { WriteOperation } from "../action";
import { Context, Data, Viewer } from "../core/base";
import { LoggedOutViewer } from "../core/viewer";
import each from "jest-each";
import {
  BooleanType,
  IntegerType,
  StringListType,
  StringType,
  UUIDType,
} from "../schema/field";
import {
  UpdateOperation,
  TransformedUpdateOperation,
  SQLStatementOperation,
  StructType,
  StructTypeAsList,
} from "../schema";
import {
  SimpleAction,
  Contact,
  EntBuilderSchema,
  BaseEnt,
} from "../testutils/builder";
import { createRowForTest } from "../testutils/write";
import * as clause from "../core/clause";
import DB, { Dialect } from "../core/db";
import { ObjectLoaderFactory } from "../core/loaders";
import { TestContext } from "../testutils/context/test_context";
import {
  assoc_edge_config_table,
  assoc_edge_table,
  getSchemaTable,
  setupSqlite,
  Table,
  TempDB,
} from "../testutils/db/temp_db";
import { convertDate, convertJSON } from "../core/convert";
import { loadRawEdgeCountX } from "../core/ent";
import {
  DeletedAtSnakeCasePattern,
  DeletedAtPattern,
  DeletedAtPatternWithExtraWrites,
} from "../testutils/soft_delete";
import { toDBColumnOrTable } from "../names/names";
import { randomEmail, randomPhoneNumber } from "../testutils/db/value";

const edges = ["edge", "inverseEdge", "symmetricEdge"];
async function createEdges() {
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
}

class User extends BaseEnt {
  nodeType = "User";
  firstName: string;

  constructor(
    public viewer: CustomViewer,
    public data: Data,
  ) {
    super(viewer, data);
    this.firstName = data.first_name;
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
    contact_info: StructType({
      fields: {
        phoneNumbers: StringListType(),
        emails: StringListType(),
      },
      tsType: "ContactInfo",
      graphQLType: "ContactInfo",
    }),
  },
});

// custom Viewer interface
// IDViewer and LoggedOutViewer implicitly implement this
interface CustomViewer extends Viewer {
  marker: string;
}

class Account extends BaseEnt {
  nodeType = "Account";

  constructor(
    public viewer: CustomViewer,
    public data: Data,
  ) {
    super(viewer, data);
  }
}

class Country extends BaseEnt {
  nodeType = "Country";

  constructor(
    public viewer: CustomViewer,
    public data: Data,
  ) {
    super(viewer, data);
  }
}

const AccountSchema = new EntBuilderSchema(Account, {
  patterns: [new DeletedAtPatternWithExtraWrites()],

  fields: {
    FirstName: StringType(),
    LastName: StringType(),
    prefs: StructType({
      fields: {
        notfisEnabled: BooleanType(),
        finishedNux: BooleanType(),
        locale: StringType(),
      },
      tsType: "AccountPrefs",
      graphQLType: "AccountPrefs",
    }),
  },
});

const CountrySchema = new EntBuilderSchema(Country, {
  patterns: [new DeletedAtPatternWithExtraWrites()],

  fields: {
    name: StringType(),
    capital: StringType(),
    cities: StructTypeAsList({
      fields: {
        name: StringType(),
        population: IntegerType(),
      },
      tsType: "City",
      graphQLType: "City",
    }),
    creatorId: UUIDType(),
  },
});

const getTables = () => {
  const tables: Table[] = [assoc_edge_config_table()];
  edges.map((edge) =>
    tables.push(assoc_edge_table(toDBColumnOrTable(edge, "table"))),
  );

  [UserSchema, ContactSchema, AccountSchema, CountrySchema].map((s) =>
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

const usersLoaderFactory = new ObjectLoaderFactory({
  tableName: "users",
  fields: ["id", "first_name", "last_name", "deleted_at"],
  key: "id",
  clause: clause.Eq("deleted_at", null),
});

const accountsLoaderFactory = new ObjectLoaderFactory({
  tableName: "accounts",
  fields: ["id", "first_name", "last_name", "prefs", "deleted_at"],
  key: "id",
  clause: clause.Eq("deleted_at", null),
});

const contactsLoaderFactory = new ObjectLoaderFactory({
  tableName: "contacts",
  fields: ["id", "first_name", "last_name", "contact_info", "deleted_at"],
  key: "id",
  clause: clause.Eq("deleted_at", null),
});

const countryLoaderFactory = new ObjectLoaderFactory({
  tableName: "countries",
  fields: ["id", "name", "capital", "cities", "creator_id", "deleted_at"],
  key: "id",
  clause: clause.Eq("deleted_at", null),
});

const usersLoaderFactoryNoClause = new ObjectLoaderFactory({
  tableName: "users",
  fields: ["id", "first_name", "last_name", "deleted_at"],
  key: "id",
});

const accountsLoaderFactoryNoClause = new ObjectLoaderFactory({
  tableName: "accounts",
  fields: ["id", "first_name", "last_name", "prefs", "deleted_at"],
  key: "id",
});

const contactsLoaderFactoryNoClause = new ObjectLoaderFactory({
  tableName: "contacts",
  fields: ["id", "first_name", "last_name", "contact_info", "deleted_at"],
  key: "id",
});

const getNewLoader = (context: boolean = true) => {
  return usersLoaderFactory.createLoader(
    context ? new TestContext() : undefined,
  );
};

const getAccountNewLoader = (context: boolean = true) => {
  return accountsLoaderFactory.createLoader(
    context ? new TestContext() : undefined,
  );
};

const getContactNewLoader = (context: boolean = true) => {
  return contactsLoaderFactory.createLoader(
    context ? new TestContext() : undefined,
  );
};

const geCountryNewLoader = (context: boolean = true) => {
  return countryLoaderFactory.createLoader(
    context ? new TestContext() : undefined,
  );
};

// deleted_at field but no custom_clause
// behavior when we're ignoring deleted_at. exception...
const getNewLoaderNoCustomClause = (context: boolean = true) => {
  return usersLoaderFactoryNoClause.createLoader(
    context ? new TestContext() : undefined,
  );
};

const getContactNewLoaderNoCustomClause = (context: boolean = true) => {
  return contactsLoaderFactoryNoClause.createLoader(
    context ? new TestContext() : undefined,
  );
};

const getAccountNewLoaderNoCustomClause = (context: boolean = true) => {
  return accountsLoaderFactoryNoClause.createLoader(
    context ? new TestContext() : undefined,
  );
};

function transformJSONRow(row: Data | null) {
  if (row === null) {
    return null;
  }
  for (const k of ["prefs", "contact_info"]) {
    if (row[k]) {
      row[k] = convertJSON(row[k]);
    }
  }
  return row;
}

function transformDeletedAt(row: Data | null) {
  if (row === null) {
    return null;
  }
  if (row.deleted_at === null || row.deleted_at === undefined) {
    return row;
  }
  row.deleted_at = convertDate(row.deleted_at);

  return transformJSONRow(row);
}

function getInsertUserAction(
  map: Map<string, any>,
  context: Context | undefined,
) {
  const viewer = new LoggedOutViewer(context);

  return new SimpleAction(viewer, UserSchema, map, WriteOperation.Insert, null);
}

function getInsertAccountAction(
  map: Map<string, any>,
  context: Context | undefined,
) {
  const viewer = new LoggedOutViewer(context);

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
  context: Context | undefined,
) {
  const viewer = new LoggedOutViewer(context);

  return new SimpleAction(
    viewer,
    ContactSchema,
    map,
    WriteOperation.Insert,
    null,
  );
}

function getInsertCountryAction(
  map: Map<string, any>,
  context: Context | undefined,
) {
  const viewer = new LoggedOutViewer(context);

  return new SimpleAction(
    viewer,
    CountrySchema,
    map,
    WriteOperation.Insert,
    null,
  );
}

function commonTests() {
  test("delete -> update", async () => {
    const loader = getNewLoader();
    const action = getInsertUserAction(
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
      loader.context,
    );
    const user = await action.saveX();

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
      new LoggedOutViewer(loader.context),
      UserSchema,
      new Map(),
      WriteOperation.Delete,
      user,
    );

    await action2.save();

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
    const loader = getAccountNewLoader();
    const action = getInsertAccountAction(
      new Map<string, any>([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
        [
          "prefs",
          {
            notfisEnabled: true,
            finishedNux: false,
            locale: "en_US",
          },
        ],
      ]),
      loader.context,
    );
    const account1 = await action.saveX();

    const action2 = getInsertAccountAction(
      new Map<string, any>([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
        [
          "prefs",
          {
            notfisEnabled: false,
            finishedNux: true,
            locale: "en_US",
          },
        ],
      ]),
      loader.context,
    );
    const account2 = await action2.saveX();

    const action3 = getInsertAccountAction(
      new Map<string, any>([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
        [
          "prefs",
          {
            notfisEnabled: true,
            finishedNux: false,
            locale: "en_US",
          },
        ],
      ]),
      loader.context,
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

    const row = await loader.load(account3.id);
    expect(transformJSONRow(row)).toMatchObject({
      id: account3.id,
      first_name: "Jon",
      last_name: "Snow",
      deleted_at: null,
      prefs: {
        notfis_enabled: true,
        finished_nux: false,
        locale: "en_US",
      },
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
      account1.viewer,
      AccountSchema,
      new Map(),
      WriteOperation.Delete,
      account3,
    );

    await action4.save();

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
      prefs: {
        notfis_enabled: true,
        finished_nux: false,
        locale: "en_US",
      },
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
    const loader = getNewLoader();
    const action = getInsertUserAction(
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
      loader.context,
    );
    const user = await action.saveX();

    const row = await loader.load(user.id);
    expect(row).toEqual({
      id: user.id,
      first_name: "Jon",
      last_name: "Snow",
      deleted_at: null,
    });

    const action2 = new SimpleAction(
      action.viewer,
      UserSchema,
      new Map(),
      WriteOperation.Delete,
      user,
    );
    action2.builder.orchestrator.setDisableTransformations(true);

    await action2.save();

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

    const loader = getNewLoader();

    const action = getInsertUserAction(
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
      loader.context,
    );
    const user = await action.saveX();
    await verifyRows(1);

    const row = await loader.load(user.id);
    expect(row).toEqual({
      id: user.id,
      first_name: "Jon",
      last_name: "Snow",
      deleted_at: null,
    });

    const tranformJonToAegon = (
      stmt: UpdateOperation<User, CustomViewer>,
    ): TransformedUpdateOperation<User, CustomViewer> | undefined => {
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
      loader.context,
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
      loader.context,
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

  function transformTODB(d: Data) {
    const result: Data = {};
    for (const k in d) {
      result[toDBColumnOrTable(k)] = d[k];
    }
    return result;
  }

  test("delete -> update. snake_case", async () => {
    const loader = getContactNewLoader();
    const contactInfo = {
      phoneNumbers: [
        randomPhoneNumber(),
        randomPhoneNumber(),
        randomPhoneNumber(),
      ],
      emails: [randomEmail(), randomEmail(), randomEmail(), randomEmail()],
    };
    const expectedContactInfo = transformTODB(contactInfo);

    const action = getInsertContactAction(
      new Map<string, any>([
        ["first_name", "Jon"],
        ["last_name", "Snow"],
        ["contact_info", contactInfo],
      ]),
      loader.context,
    );
    const contact = await action.saveX();

    const row = await loader.load(contact.id);
    expect(transformJSONRow(row)).toEqual({
      id: contact.id,
      first_name: "Jon",
      last_name: "Snow",
      contact_info: expectedContactInfo,
      deleted_at: null,
    });

    const d = new Date();
    advanceTo(d);
    const action2 = new SimpleAction(
      action.viewer,
      ContactSchema,
      new Map(),
      WriteOperation.Delete,
      contact,
    );

    await action2.save();

    const row2 = await loader.load(contact.id);
    expect(row2).toBeNull();

    // loader which bypasses transformations
    const loader2 = getContactNewLoaderNoCustomClause();
    const row3 = await loader2.load(contact.id);
    expect(transformDeletedAt(row3)).toEqual({
      id: contact.id,
      first_name: "Jon",
      last_name: "Snow",
      contact_info: expectedContactInfo,
      deleted_at: d,
    });
  });

  test("really delete. snake_case", async () => {
    const loader = getContactNewLoader();
    const contactInfo = {
      phoneNumbers: [
        randomPhoneNumber(),
        randomPhoneNumber(),
        randomPhoneNumber(),
      ],
      emails: [randomEmail(), randomEmail(), randomEmail(), randomEmail()],
    };
    const expectedContactInfo = transformTODB(contactInfo);
    const action = getInsertContactAction(
      new Map<string, any>([
        ["first_name", "Jon"],
        ["last_name", "Snow"],
        ["contact_info", contactInfo],
      ]),
      loader.context,
    );
    const contact = await action.saveX();

    const row = await loader.load(contact.id);
    expect(transformJSONRow(row)).toEqual({
      id: contact.id,
      first_name: "Jon",
      last_name: "Snow",
      contact_info: expectedContactInfo,
      deleted_at: null,
    });

    const action2 = new SimpleAction(
      action.viewer,
      ContactSchema,
      new Map(),
      WriteOperation.Delete,
      contact,
    );
    action2.builder.orchestrator.setDisableTransformations(true);

    await action2.save();

    const row2 = await loader.load(contact.id);
    expect(row2).toBeNull();

    // loader which bypasses transformations
    const loader2 = getContactNewLoaderNoCustomClause();
    const row3 = await loader2.load(contact.id);
    expect(row3).toBe(null);
  });

  each(["contact_info", "contactInfo"]).test(
    "insert -> update with data",
    async (contactInfoKey: string) => {
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
      const loader = getContactNewLoader();

      const contactInfo = {
        phoneNumbers: [
          randomPhoneNumber(),
          randomPhoneNumber(),
          randomPhoneNumber(),
        ],
        emails: [randomEmail(), randomEmail(), randomEmail(), randomEmail()],
      };
      const expectedContactInfo = transformTODB(contactInfo);
      const action = getInsertContactAction(
        new Map<string, any>([
          ["first_name", "Jon"],
          ["last_name", "Snow"],
          ["contact_info", contactInfo],
        ]),
        loader.context,
      );
      const contact = await action.saveX();
      await verifyRows(1);

      const row = await loader.load(contact.id);
      expect(transformJSONRow(row)).toEqual({
        id: contact.id,
        first_name: "Jon",
        last_name: "Snow",
        contact_info: expectedContactInfo,
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
        const contactInfo = stmt.data.get("contact_info");

        if (firstName == "Aegon" && lastName == "Targaryen") {
          return {
            op: SQLStatementOperation.Update,
            existingEnt: contact,
            data: {
              first_name: "Aegon",
              last_name: "Targaryen",
              [contactInfoKey]: {
                phoneNumbers: contactInfo.phoneNumbers,
                emails: contactInfo.emails,
              },
            },
          };
        }
      };

      const action2 = getInsertContactAction(
        new Map<string, any>([
          ["first_name", "Aegon"],
          ["last_name", "Targaryen"],
          ["contact_info", contactInfo],
        ]),
        loader.context,
      );
      // @ts-ignore
      action2.transformWrite = tranformJonToAegon;

      const contact2 = await action2.saveX();
      expect(contact.id).toBe(contact2.id);
      expect(contact2.data.first_name).toBe("Aegon");
      expect(contact2.data.last_name).toBe("Targaryen");
      await verifyRows(1);

      const action3 = getInsertContactAction(
        new Map<string, any>([
          ["first_name", "Sansa"],
          ["last_name", "Stark"],
          ["contact_info", contactInfo],
        ]),
        loader.context,
      );
      // @ts-ignore
      action3.transformWrite = tranformJonToAegon;

      // new contact craeted
      const contact3 = await action3.saveX();
      expect(contact.id).not.toBe(contact3.id);
      expect(contact3.data.first_name).toBe("Sansa");
      expect(contact3.data.last_name).toBe("Stark");
      await verifyRows(2);
    },
  );

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
    const loader = getContactNewLoader();
    const contactInfo = {
      phoneNumbers: [
        randomPhoneNumber(),
        randomPhoneNumber(),
        randomPhoneNumber(),
      ],
      emails: [randomEmail(), randomEmail(), randomEmail(), randomEmail()],
    };
    const expectedContactInfo = transformTODB(contactInfo);
    const action = getInsertContactAction(
      new Map<string, any>([
        ["first_name", "Jon"],
        ["last_name", "Snow"],
        ["contact_info", contactInfo],
      ]),
      loader.context,
    );
    const contact = await action.saveX();
    await verifyRows(1);

    const row = await loader.load(contact.id);
    expect(transformJSONRow(row)).toEqual({
      id: contact.id,
      first_name: "Jon",
      last_name: "Snow",
      contact_info: expectedContactInfo,
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
      new Map<string, any>([
        ["first_name", "Aegon"],
        ["last_name", "Targaryen"],
        ["contact_info", contactInfo],
      ]),
      loader.context,
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
    const loader = getContactNewLoader();
    const contactInfo = {
      phoneNumbers: [
        randomPhoneNumber(),
        randomPhoneNumber(),
        randomPhoneNumber(),
      ],
      emails: [randomEmail(), randomEmail(), randomEmail(), randomEmail()],
    };
    const expectedContactInfo = transformTODB(contactInfo);
    const action = getInsertContactAction(
      new Map<string, any>([
        ["first_name", "Jon"],
        ["last_name", "Snow"],
        ["contact_info", contactInfo],
      ]),
      loader.context,
    );
    const contact = await action.saveX();
    await verifyRows(1);

    const row = await loader.load(contact.id);
    expect(transformJSONRow(row)).toEqual({
      id: contact.id,
      first_name: "Jon",
      last_name: "Snow",
      contact_info: expectedContactInfo,
      deleted_at: null,
    });

    const tranformJonToAegon = (
      stmt: UpdateOperation<Contact>,
    ): TransformedUpdateOperation<Contact> | undefined => {
      throw new Error("test failure");
    };

    const action2 = getInsertContactAction(
      new Map<string, any>([
        ["first_name", "Aegon"],
        ["last_name", "Targaryen"],
        ["contact_info", contactInfo],
      ]),
      loader.context,
    );
    // @ts-ignore
    action2.transformWrite = tranformJonToAegon;

    await expect(action2.saveX()).rejects.toThrow(/test failure/);
  });

  test("insert -> update  w StructAsList", async () => {
    const verifyRows = async (ct: number) => {
      if (Dialect.Postgres !== DB.getDialect()) {
        return;
      }
      const res = await DB.getInstance()
        .getPool()
        .query("select count(1) from countries;");
      expect(parseInt(res.rows[0].count)).toBe(ct);
    };
    await verifyRows(0);
    const loader = geCountryNewLoader();

    const creatorId = uuidv4();

    const cities = [
      { name: "New York", population: 8000000 },
      { name: "Los Angeles", population: 4000000 },
      { name: "San Francisco", population: 800000 },
    ];
    const action = getInsertCountryAction(
      new Map<string, any>([
        ["name", "USA"],
        ["capital", "Washington DC"],
        ["cities", cities],
        ["creatorId", creatorId],
      ]),
      loader.context,
    );
    const country = await action.saveX();
    await verifyRows(1);

    const row = await loader.load(country.id);
    expect(row).not.toBeNull();
    row!["cities"] = convertJSON(row!["cities"]);
    expect(transformJSONRow(row)).toMatchObject({
      id: country.id,
      name: "USA",
      capital: "Washington DC",
      cities: cities,
      creator_id: creatorId,
      deleted_at: null,
    });

    const transformUSA = (
      stmt: UpdateOperation<Country>,
    ): TransformedUpdateOperation<Country> | undefined => {
      if (stmt.op != SQLStatementOperation.Insert || !stmt.data) {
        return;
      }

      const name = stmt.data.get("name");

      if (name == "USA") {
        return {
          op: SQLStatementOperation.Update,
          existingEnt: country,
          data: {
            name: "USA",
            capital: "Washington DC 2",
            cities: cities,
            creatorId: creatorId,
          },
        };
      }
    };

    const action2 = getInsertCountryAction(
      new Map<string, any>([
        ["name", "USA"],
        ["capital", "Washington DC"],
      ]),
      loader.context,
    );
    // @ts-ignore
    action2.transformWrite = transformUSA;

    const country2 = await action2.saveX();
    expect(country.id).toBe(country2.id);
    expect(country2.data.name).toBe("USA");
    expect(country2.data.capital).toBe("Washington DC 2"); // confirm updated
    await verifyRows(1);

    const action3 = getInsertCountryAction(
      new Map<string, any>([
        ["name", "France"],
        ["capital", "Paris"],
        [
          "cities",
          [
            { name: "Paris", population: 8000000 },
            { name: "Lyon", population: 4000000 },
            { name: "Marseille", population: 800000 },
          ],
        ],
        ["creatorId", creatorId],
      ]),
      loader.context,
    );
    // @ts-ignore
    action3.transformWrite = transformUSA;

    // new contact created
    const country3 = await action3.saveX();
    expect(country.id).not.toBe(country3.id);
    expect(country3.data.name).toBe("France");
    expect(country3.data.capital).toBe("Paris");
    expect(convertJSON(country3.data.cities)).toEqual([
      { name: "Paris", population: 8000000 },
      { name: "Lyon", population: 4000000 },
      { name: "Marseille", population: 800000 },
    ]);
    await verifyRows(2);
  });
}

// TODO trait implemented...
// for deleted etc to check value

// TODO fix other tests with loaders etc
// TODO try with v0.1.x
