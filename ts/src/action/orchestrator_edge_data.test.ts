import { WriteOperation } from "../action";
import { snakeCase } from "snake-case";
import DB, { Dialect } from "../core/db";
import {
  assoc_edge_config_table,
  assoc_edge_table,
  getSchemaTable,
  setupSqlite,
  Table,
  TempDB,
} from "../testutils/db/temp_db";
import { Viewer } from "../core/base";
import { LoggedOutViewer } from "../core/viewer";
import { StringType } from "../schema";
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
  loadEdges,
  loadRawEdgeCountX,
  setGlobalSchema,
} from "../core/ent";
import {
  EdgeWithDeletedAt,
  testEdgeGlobalSchema,
} from "../testutils/test_edge_global_schema";

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

const getInitialTables = (dialect: Dialect) => {
  const tables: Table[] = [assoc_edge_config_table()];

  [UserSchema].map((s) => tables.push(getSchemaTable(s, dialect)));

  return tables;
};

function setupEdgeTables(tdb: TempDB, global = false) {
  if (global) {
    beforeAll(() => {
      setGlobalSchema(testEdgeGlobalSchema);
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
      const t = assoc_edge_table(`${snakeCase(edge)}_table`, global);
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

interface VerifyOptions<T extends AssocEdge> {
  symmetric: User;
  inverse: User;
  verifyEdge?: (edge: T) => void;
}

async function doVerifyAddedEdges<T extends AssocEdge>(
  user: User,
  ctr: AssocEdgeConstructor<T>,
  opts: VerifyOptions<T>,
) {
  const verifyEdges = (edges: T[]) => {
    if (!opts.verifyEdge) {
      return;
    }
    edges.map((edge) => opts.verifyEdge!(edge));
  };
  const edges = await loadCustomEdges({
    id1: user.id,
    edgeType: "edge",
    ctr,
  });
  const edgesCount = await loadRawEdgeCountX({
    id1: user.id,
    edgeType: "edge",
  });
  verifyEdges(edges);
  expect(edges.length).toBe(2);
  expect(edgesCount).toBe(2);
  expect(
    edges
      .map((edge) => edge.id2)
      .every((id) => [opts.symmetric.id, opts.inverse.id].includes(id)),
  ).toBe(true);

  const symmetricEdges = await loadCustomEdges({
    id1: user.id,
    edgeType: "symmetricEdge",
    ctr,
  });
  verifyEdges(symmetricEdges);

  expect(symmetricEdges.length).toBe(1);
  expect(symmetricEdges[0].id2).toBe(opts.symmetric.id);
  const symmetricEdgesCount = await loadRawEdgeCountX({
    id1: user.id,
    edgeType: "symmetricEdge",
  });
  expect(symmetricEdgesCount).toBe(1);

  for (const id of [opts.symmetric.id, opts.inverse.id]) {
    const inverseEdges = await loadCustomEdges({
      id1: id,
      edgeType: "inverseEdge",
      ctr,
    });
    expect(inverseEdges.length).toBe(1);
    expect(inverseEdges[0].id2).toBe(user.id);
    verifyEdges(inverseEdges);

    const inverseEdgesCount = await loadRawEdgeCountX({
      id1: id,
      edgeType: "inverseEdge",
    });
    expect(inverseEdgesCount).toBe(1);

    if (id === opts.symmetric.id) {
      const symmetricEdges = await loadCustomEdges({
        id1: id,
        edgeType: "symmetricEdge",
        ctr,
      });
      expect(symmetricEdges.length).toBe(1);
      expect(symmetricEdges[0].id2).toBe(user.id);
      verifyEdges(symmetricEdges);

      const symmetricEdgesCount = await loadRawEdgeCountX({
        id1: id,
        edgeType: "symmetricEdge",
      });
      expect(symmetricEdgesCount).toBe(1);
    }
  }

  return { edges, symmetricEdges };
}

async function doTestAddEdge<T extends AssocEdge>(
  ctr: AssocEdgeConstructor<T>,
  verifyEdge?: (edge: T) => void,
) {
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

  const { edges, symmetricEdges } = await doVerifyAddedEdges(user3, ctr, {
    symmetric: user1,
    inverse: user2,
    verifyEdge,
  });

  return {
    user: user3,
    edges,
    symmetric: user1,
    inverse: user2,
    symmetricEdges,
  };
}

async function doTestRemoveEdge<T extends AssocEdge>(
  ctr: AssocEdgeConstructor<T>,
  verifyEdge?: (edge: T) => void,
) {
  const { user, symmetric, inverse, edges, symmetricEdges } =
    await doTestAddEdge(ctr, verifyEdge);

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

  return { user, edges, symmetricEdges, symmetric, inverse };
}

async function doTestAddAndRemoveEdge<T extends AssocEdge>(
  ctr: AssocEdgeConstructor<T>,
  verifyEdge?: (edge: T) => void,
) {
  const { user, edges, symmetricEdges, symmetric, inverse } =
    await doTestRemoveEdge(ctr, verifyEdge);

  const action = new SimpleAction(
    user.viewer,
    UserSchema,
    new Map(),
    WriteOperation.Edit,
    user,
  );

  for (const edge of edges) {
    action.builder.orchestrator.addOutboundEdge(
      edge.id2,
      edge.edgeType,
      "user",
    );
  }
  for (const edge of symmetricEdges) {
    action.builder.orchestrator.addOutboundEdge(
      edge.id2,
      edge.edgeType,
      "symmetricEdge",
    );
  }
  await action.saveX();

  await doVerifyAddedEdges(user, ctr, {
    symmetric,
    inverse,
    verifyEdge,
  });
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
    const reloadEdgesCount = await loadRawEdgeCountX({
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
    const reloadSymmetricEdgesCount = await loadRawEdgeCountX({
      id1: user.id,
      edgeType: "symmetricEdge",
      // shouldn't do anything
      disableTransformations: true,
    });
    expect(reloadEdges.length).toBe(0);
    expect(reloadSymmetricEdges.length).toBe(0);

    expect(reloadEdgesCount).toBe(0);
    expect(reloadSymmetricEdgesCount).toBe(0);
  });

  test("add and remove edge", async () => {
    await doTestAddAndRemoveEdge(AssocEdge);
  });
}

function commonTestsGlobalSchema() {
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
    const reloadEdgesCount = await loadRawEdgeCountX({
      id1: user.id,
      edgeType: "edge",
    });
    const reloadSymmetricEdges = await loadCustomEdges({
      id1: user.id,
      edgeType: "symmetricEdge",
      ctr: EdgeWithDeletedAt,
    });
    const reloadSymmetricEdgesCount = await loadRawEdgeCountX({
      id1: user.id,
      edgeType: "symmetricEdge",
    });
    expect(reloadEdges.length).toBe(0);
    expect(reloadSymmetricEdges.length).toBe(0);
    expect(reloadEdgesCount).toBe(0);
    expect(reloadSymmetricEdgesCount).toBe(0);

    // reload with no transformations and we can get the raw data out of it and see the deleted_at flag set to a given time
    const reloadEdges2 = await loadCustomEdges({
      id1: user.id,
      edgeType: "edge",
      disableTransformations: true,
      ctr: EdgeWithDeletedAt,
    });
    const reloadEdges2Count = await loadRawEdgeCountX({
      id1: user.id,
      edgeType: "edge",
      disableTransformations: true,
    });
    const reloadSymmetricEdges2 = await loadCustomEdges({
      id1: user.id,
      edgeType: "symmetricEdge",
      disableTransformations: true,
      ctr: EdgeWithDeletedAt,
    });
    const reloadSymmetricEdges2Count = await loadRawEdgeCountX({
      id1: user.id,
      edgeType: "symmetricEdge",
      disableTransformations: true,
    });
    expect(reloadEdges2.length).toBe(2);
    expect(reloadEdges2Count).toBe(2);
    reloadEdges2.map((edge) => expect(edge.deletedAt).not.toBeNull());

    expect(reloadSymmetricEdges2.length).toBe(1);
    expect(reloadSymmetricEdges2Count).toBe(1);
    reloadSymmetricEdges2.map((edge) => expect(edge.deletedAt).not.toBeNull());
  });

  test("add and remove edge", async () => {
    await doTestAddAndRemoveEdge(EdgeWithDeletedAt, verifyEdge);
  });
}
