import { WriteOperation } from "../action";
import { snakeCase } from "snake-case";
import DB, { Dialect } from "../core/db";
import {
  assoc_edge_config_table,
  assoc_edge_table,
  getColumnFromField,
  getSchemaTable,
  setupSqlite,
  Table,
  TempDB,
} from "../testutils/db/temp_db";
import { Data, Viewer } from "../core/base";
import { LoggedOutViewer } from "../core/viewer";
import {
  SQLStatementOperation,
  StringType,
  TimestampType,
  TransformedUpdateOperation,
  UpdateOperation,
} from "../schema";
import {
  User,
  SimpleAction,
  getBuilderSchemaFromFields,
} from "../testutils/builder";
import { createRowForTest } from "../testutils/write";
import {
  AssocEdge,
  AssocEdgeConstructor,
  clearGlobalSchema,
  loadCustomEdges,
  loadEdgeData,
  loadEdges,
  setGlobalSchema,
} from "../core/ent";
import * as clause from "../core/clause";
import { create } from "domain";

const UserSchema = getBuilderSchemaFromFields(
  {
    FirstName: StringType(),
    LastName: StringType(),
  },
  User,
);

function getInsertUserAction(
  map: Map<string, any>,
  viewer: Viewer = new LoggedOutViewer(),
) {
  return new SimpleAction(viewer, UserSchema, map, WriteOperation.Insert, null);
}

const edges = ["edge", "inverseEdge", "symmetricEdge"];

const globalSchema = {
  extraEdgeFields: {
    // need this to be lowerCamelCase because we do this based on field name
    // #510
    deletedAt: TimestampType({
      nullable: true,
      index: true,
      defaultValueOnCreate: () => null,
    }),
  },

  transformEdgeRead(): clause.Clause {
    return clause.Eq("deleted_at", null);
  },

  transformEdgeWrite(
    stmt: UpdateOperation<any>,
  ): TransformedUpdateOperation<any> | null {
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
  },
};

const getInitialTables = (dialect: Dialect) => {
  const tables: Table[] = [assoc_edge_config_table()];

  [UserSchema].map((s) => tables.push(getSchemaTable(s, dialect)));

  return tables;
};

function setupEdgeTables(tdb: TempDB, global = false) {
  if (global) {
    beforeAll(() => {
      setGlobalSchema(globalSchema);
    });
    afterAll(() => {
      clearGlobalSchema();
    });
  }
  beforeAll(async () => {
    await createEdgeRows();
  });

  afterAll(async () => {
    await DB.getInstance().getPool().query("DELETE from assoc_edge_config");
  });

  beforeEach(async () => {
    const tables: Table[] = [];
    edges.map((edge) => {
      const t = assoc_edge_table(`${snakeCase(edge)}_table`);

      if (global) {
        for (const k in globalSchema.extraEdgeFields) {
          const col = getColumnFromField(
            k,
            globalSchema.extraEdgeFields[k],
            Dialect.Postgres,
          );
          t.columns.push(col);
        }
      }
      tables.push(t);
    });
    await tdb.create(...tables);
  });

  afterEach(async () => {
    await tdb.drop(...edges.map((edge) => `${snakeCase(edge)}_table`));
  });
}

async function createEdgeRows() {
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

function setupPostgres() {
  const tdb = new TempDB(Dialect.Postgres, getInitialTables(Dialect.Postgres));

  beforeAll(async () => {
    await tdb.beforeAll();
  });

  afterAll(async () => {
    await tdb.afterAll();
  });
  return tdb;
}

describe("postgres", () => {
  const tdb = setupPostgres();

  describe("postgres no global schema", () => {
    setupEdgeTables(tdb, false);
    commonTestsNoGlobalSchema();
  });

  describe("postgres global schema", () => {
    setupEdgeTables(tdb, true);
    commonTestsGlobalSchema();
  });
});

describe("sqlite", () => {
  const tdb = setupSqlite(`sqlite:///orchestrator-edge-data-test.db`, () =>
    getInitialTables(Dialect.SQLite),
  );

  describe("sqlite no global schema", () => {
    setupEdgeTables(tdb, false);
    commonTestsNoGlobalSchema();
  });

  describe("sqlite global schema", () => {
    setupEdgeTables(tdb, true);
    commonTestsGlobalSchema();
  });
});

async function doTestAddEdge<T extends AssocEdge>(
  ctr: AssocEdgeConstructor<T>,
  verifyEdge?: (edge: T) => void,
) {
  const verifyEdges = (edges: T[]) => {
    if (!verifyEdge) {
      return;
    }
    edges.map((edge) => verifyEdge(edge));
  };
  const user1 = await getInsertUserAction(
    new Map([
      ["FirstName", "Jon"],
      ["LastName", "Snow"],
    ]),
  ).saveX();
  const user2 = await getInsertUserAction(
    new Map([
      ["FirstName", "Arya"],
      ["LastName", "Stark"],
    ]),
  ).saveX();
  const action = getInsertUserAction(
    new Map([
      ["FirstName", "Sansa"],
      ["LastName", "Stark"],
    ]),
  );
  action.builder.orchestrator.addOutboundEdge(user1.id, "edge", user1.nodeType);
  action.builder.orchestrator.addOutboundEdge(user2.id, "edge", user2.nodeType);

  action.builder.orchestrator.addOutboundEdge(
    user1.id,
    "symmetricEdge",
    user1.nodeType,
  );
  const user3 = await action.saveX();

  const edges = await loadCustomEdges({
    id1: user3.id,
    edgeType: "edge",
    ctr,
  });
  verifyEdges(edges);
  expect(edges.length).toBe(2);
  expect(
    edges
      .map((edge) => edge.id2)
      .every((id) => [user1.id, user2.id].includes(id)),
  ).toBe(true);

  const symmetricEdges = await loadCustomEdges({
    id1: user3.id,
    edgeType: "symmetricEdge",
    ctr,
  });
  verifyEdges(symmetricEdges);

  expect(symmetricEdges.length).toBe(1);
  expect(symmetricEdges[0].id2).toBe(user1.id);

  for (const id of [user1.id, user2.id]) {
    const inverseEdges = await loadCustomEdges({
      id1: id,
      edgeType: "inverseEdge",
      ctr,
    });
    expect(inverseEdges.length).toBe(1);
    expect(inverseEdges[0].id2).toBe(user3.id);
    verifyEdges(inverseEdges);

    if (id === user1.id) {
      const symmetricEdges = await loadCustomEdges({
        id1: id,
        edgeType: "symmetricEdge",
        ctr,
      });
      expect(symmetricEdges.length).toBe(1);
      expect(symmetricEdges[0].id2).toBe(user3.id);
      verifyEdges(symmetricEdges);
    }
  }

  return {
    user: user3,
    edges,
    symmetricEdges,
  };
}

async function doTestRemoveEdge<T extends AssocEdge>(
  ctr: AssocEdgeConstructor<T>,
  verifyEdge?: (edge: T) => void,
) {
  const { user, edges, symmetricEdges } = await doTestAddEdge(ctr, verifyEdge);

  const action = new SimpleAction(
    user.viewer,
    UserSchema,
    new Map(),
    WriteOperation.Edit,
    user,
  );
  for (const edge of edges) {
    action.builder.orchestrator.removeOutboundEdge(edge.id2, edge.edgeType);
  }
  for (const edge of symmetricEdges) {
    action.builder.orchestrator.removeOutboundEdge(edge.id2, edge.edgeType);
  }
  await action.saveX();

  return { user, edges, symmetricEdges };
}

function commonTestsNoGlobalSchema() {
  test("add edge", async () => {
    await doTestAddEdge(AssocEdge);
  });

  test("remove edge", async () => {
    const { user } = await doTestRemoveEdge(AssocEdge);

    const reloadEdges = await loadEdges({
      id1: user.id,
      edgeType: "edge",
      // shouldn't do anything
      disableTransformations: true,
    });
    const reloadSymmetricEdges = await loadEdges({
      id1: user.id,
      edgeType: "symmetricEdge",
      // shouldn't do anything
      disableTransformations: true,
    });
    expect(reloadEdges.length).toBe(0);
    expect(reloadSymmetricEdges.length).toBe(0);
  });
}

function commonTestsGlobalSchema() {
  class EdgeWithDeletedAt extends AssocEdge {
    deletedAt: Date | null;

    constructor(data: Data) {
      super(data);
      this.deletedAt = data.deleted_at;
    }
  }

  async function verifyEdge(edge: EdgeWithDeletedAt) {
    expect(edge.deletedAt).toBe(null);
  }

  test("add edge", async () => {
    await doTestAddEdge(EdgeWithDeletedAt, verifyEdge);
  });

  test("remove edge", async () => {
    const { user } = await doTestRemoveEdge(EdgeWithDeletedAt, verifyEdge);

    // by default nothing is returned...
    const reloadEdges = await loadCustomEdges({
      id1: user.id,
      edgeType: "edge",
      ctr: EdgeWithDeletedAt,
    });
    const reloadSymmetricEdges = await loadCustomEdges({
      id1: user.id,
      edgeType: "symmetricEdge",
      ctr: EdgeWithDeletedAt,
    });
    expect(reloadEdges.length).toBe(0);
    expect(reloadSymmetricEdges.length).toBe(0);

    // reload with no transformations and we can get the raw data out of it and see the deleted_at flag set to a given time
    const reloadEdges2 = await loadCustomEdges({
      id1: user.id,
      edgeType: "edge",
      disableTransformations: true,
      ctr: EdgeWithDeletedAt,
    });
    const reloadSymmetricEdges2 = await loadCustomEdges({
      id1: user.id,
      edgeType: "symmetricEdge",
      disableTransformations: true,
      ctr: EdgeWithDeletedAt,
    });
    expect(reloadEdges2.length).toBe(2);
    reloadEdges2.map((edge) => expect(edge.deletedAt).not.toBeNull());
    expect(reloadSymmetricEdges2.length).toBe(1);
    reloadSymmetricEdges2.map((edge) => expect(edge.deletedAt).not.toBeNull());
  });
}
