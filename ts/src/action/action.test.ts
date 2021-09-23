import { User, BuilderSchema, SimpleBuilder } from "../testutils/builder";
import { IDViewer, LoggedOutViewer } from "../core/viewer";
import { Pool } from "pg";
import { QueryRecorder } from "../testutils/db_mock";
import { Field, StringType, UUIDType } from "../schema";
import { createRowForTest } from "../testutils/write";
import {
  AssocEdge,
  buildInsertQuery,
  buildQuery,
  buildUpdateQuery,
  loadEdgeForID2,
  assocEdgeLoader,
} from "../core/ent";
import { setEdgeTypeInGroup, WriteOperation } from "./action";
import { MockLogs } from "../testutils/mock_log";
import { setLogLevels } from "../core/logger";
import { Data, ID } from "../core/base";
import {
  assoc_edge_config_table,
  assoc_edge_table,
  setupSqlite,
  table,
  text,
} from "../testutils/db/test_db";
import DB, { Dialect } from "../core/db";
import * as clause from "../core/clause";

jest.mock("pg");
QueryRecorder.mockPool(Pool);
const ml = new MockLogs();

beforeEach(async () => {
  // does assoc_edge_config loader need to be cleared?
  await createEdgeRows(["edge"]);
  QueryRecorder.clearQueries();
  ml.clear();
});

afterEach(() => {
  assocEdgeLoader.clearAll();
});

describe("postgres", () => {
  beforeAll(() => {
    ml.mock();
    setLogLevels(["query", "error", "debug"]);
  });

  afterAll(() => {
    ml.restore();
  });

  afterEach(() => {
    ml.clear();
    QueryRecorder.clear();
  });
  commonTests();
});

describe("sqlite", () => {
  beforeAll(() => {
    ml.mock();
    setLogLevels(["query", "error", "debug"]);
  });

  afterAll(() => {
    ml.restore();
  });
  afterEach(() => {
    QueryRecorder.clear();
    ml.clear();
  });
  setupSqlite(`sqlite:///action-test.db`, () => [
    table(
      "users",
      // uuid field goes here
      text("id", { primaryKey: true }),
      text("foo"),
    ),
    assoc_edge_config_table(),
    assoc_edge_table("edge_table"),
    assoc_edge_table("edge1_table"),
    assoc_edge_table("edge2_table"),
    assoc_edge_table("edge3_table"),
  ]);

  commonTests();
});

class UserSchema implements BuilderSchema<User> {
  ent = User;
  fields: Field[] = [
    UUIDType({
      name: "id",
    }),
    StringType({
      name: "foo",
    }),
  ];
}
const viewer = new LoggedOutViewer();
const schema = new UserSchema();

function getUserCreateBuilder(): SimpleBuilder<User> {
  return new SimpleBuilder(
    viewer,
    schema,
    new Map([
      ["id", "{id}"],
      ["foo", "bar"],
    ]),
  );
}

function getInsertQuery(id: ID) {
  const [query, _, logValues] = buildInsertQuery(
    {
      tableName: "users",
      fields: {
        id: id,
        foo: "bar",
      },
      fieldsToLog: {
        id: id,
        foo: "bar",
      },
    },
    "RETURNING *",
  );
  return { query, values: logValues };
}

function getUpdateQuery(ent: User) {
  const [query, _, logValues] = buildUpdateQuery(
    {
      key: "id",
      tableName: "users",
      fields: {
        foo: "bar",
      },
      fieldsToLog: {
        foo: "bar",
      },
    },
    ent.id,
    "RETURNING *",
  );
  return { query, values: logValues };
}

function getUserEditBuilder(
  user: User,
  m: Map<string, any>,
): SimpleBuilder<User> {
  return new SimpleBuilder(
    new IDViewer(user.id),
    schema,
    m,
    WriteOperation.Edit,
    user,
  );
}

async function createUser(): Promise<User> {
  const builder = getUserCreateBuilder();
  await builder.saveX();
  return await builder.editedEntX();
}

async function createEdgeRows(edges: string[]) {
  for (const edge of edges) {
    await createRowForTest({
      tableName: "assoc_edge_config",
      fields: {
        edge_table: `${edge}_table`,
        symmetric_edge: false,
        inverse_edge_type: null,
        edge_type: edge,
        edge_name: "name",
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
  }
}

function getSelectQuery(id: ID): Data | undefined {
  if (DB.getDialect() === Dialect.SQLite) {
    // need a query after the insert because sqlite doesn't support returning *
    return {
      query: buildQuery({
        tableName: "users",
        fields: ["*"],
        clause: clause.Eq("id", id),
      }),
      values: [id],
    };
  }
}

function augmentLogs(id: ID, expectedLogs: Data[], spliceIndex?: number) {
  const selectQuery = getSelectQuery(id);
  if (selectQuery) {
    if (spliceIndex === undefined) {
      expectedLogs.push(selectQuery);
    } else {
      expectedLogs.splice(spliceIndex, 0, selectQuery);
    }
  }
}

function augmentAndVerifyLogs(
  id: ID,
  expectedLogs: Data[],
  spliceIndex?: number,
) {
  augmentLogs(id, expectedLogs, spliceIndex);
  expect(ml.logs).toEqual(expectedLogs);
}

function commonTests() {
  test("simple", async () => {
    const builder = getUserCreateBuilder();

    await builder.saveX();
    let ent = await builder.editedEntX();

    const expectedLogs: Data[] = [getInsertQuery(ent.id)];
    augmentAndVerifyLogs(ent.id, expectedLogs);
  });

  test("new ent with edge", async () => {
    const date = new Date();
    const builder = getUserCreateBuilder();
    const id2 = QueryRecorder.newID();
    builder.orchestrator.addOutboundEdge(id2, "edge", "User", { time: date });
    await builder.saveX();
    let ent = await builder.editedEntX();

    let expLength = 3;
    const selectQuery = getSelectQuery(ent.id);
    let lastIdx = 2;
    if (selectQuery) {
      expLength = 4;
      lastIdx = 3;
      expect(ml.logs[2]).toEqual(selectQuery);
    }
    expect(ml.logs.length).toEqual(expLength);
    expect(ml.logs[0].query).toMatch(/SELECT (.+) FROM assoc_edge_config/);
    expect(ml.logs[1]).toEqual(getInsertQuery(ent.id));

    // select for sqlite

    const fields = {
      id1: ent.id,
      id2: id2,
      id1_type: "User",
      id2_type: "User",
      edge_type: "edge",
      data: null,
      time: date.toISOString(),
    };
    const [query, _, logValues] = buildInsertQuery(
      {
        tableName: "edge_table",
        fields: fields,
        fieldsToLog: fields,
      },
      "ON CONFLICT(id1, edge_type, id2) DO UPDATE SET data = EXCLUDED.data",
    );
    expect(ml.logs[lastIdx]).toEqual({
      query: query,
      values: logValues,
    });
  });

  test("existing ent with edge", async () => {
    const date = new Date();
    const user = await createUser();
    ml.clear();

    const builder = getUserEditBuilder(user, new Map([["foo", "bar"]]));
    const id2 = QueryRecorder.newID();

    builder.orchestrator.addOutboundEdge(id2, "edge", "User", {
      time: date,
    });
    await builder.saveX();
    let ent = await builder.editedEntX();

    let expLength = 3;
    // select for sqlite
    const selectQuery = getSelectQuery(ent.id);
    let lastIdx = 2;
    if (selectQuery) {
      lastIdx = 3;
      expect(ml.logs[2]).toEqual(selectQuery);
      expLength = 4;
    }

    expect(ml.logs.length).toEqual(expLength);
    expect(ml.logs[0].query).toMatch(/SELECT (.+) FROM assoc_edge_config/);
    expect(ml.logs[1]).toEqual(getUpdateQuery(ent));

    const fields = {
      id1: ent.id,
      id2: id2,
      id1_type: "User",
      id2_type: "User",
      edge_type: "edge",
      data: null,
      time: date.toISOString(),
    };
    const [query, _, logValues] = buildInsertQuery(
      {
        tableName: "edge_table",
        fields: fields,
        fieldsToLog: fields,
      },
      "ON CONFLICT(id1, edge_type, id2) DO UPDATE SET data = EXCLUDED.data",
    );
    expect(ml.logs[lastIdx]).toEqual({
      query: query,
      values: logValues,
    });
  });

  test("insert with incorrect resolver", async () => {
    const builder = getUserCreateBuilder();
    const builder2 = getUserCreateBuilder();
    builder.orchestrator.addOutboundEdge(builder2, "edge", "User");

    try {
      await builder.saveX();
      fail("should have thrown exception");
    } catch (error) {
      expect(error.message).toMatch(/could not resolve placeholder value/);
    }

    const id = QueryRecorder.getCurrentIDs()[0];
    expect(ml.logs[0].query).toMatch(/SELECT (.+) FROM assoc_edge_config/);
    expect(ml.logs[1]).toEqual(getInsertQuery(id));
    const selectQuery = getSelectQuery(id);
    let expLength = 2;
    if (selectQuery) {
      expect(ml.logs[2]).toEqual(selectQuery);
      expLength = 3;
    }
    expect(ml.logs.length).toEqual(expLength);

    // TODO we don't log BEGIN, ROLLBACK, COMMIT... with the refactors
  });

  describe("setEdgeTypeInGroup", () => {
    const edgeTypes = ["edge1", "edge2", "edge3"];
    let user1: User, user2: User;
    let m = new Map<string, string>();

    beforeEach(async () => {
      for (const edgeType of edgeTypes) {
        m.set(edgeType + "Enum", edgeType);
      }

      await createEdgeRows(edgeTypes);
      [user1, user2] = await Promise.all([createUser(), createUser()]);
    });

    async function verifyEdges(edgeTypes: string[], edgeSet: string) {
      const edges = await Promise.all(
        edgeTypes.map(async (edgeType) => {
          return await loadEdgeForID2({
            id1: user1.id,
            id2: user2.id,
            edgeType,
            ctr: AssocEdge,
          });
        }),
      );
      for (let i = 0; i < edges.length; i++) {
        const edge = edges[i];
        const edgeType = edgeTypes[i];

        if (edgeType == edgeSet) {
          expect(edge).toBeDefined();
          expect(edge?.id1).toBe(user1.id);
          expect(edge?.id2).toBe(user2.id);
          expect(edge?.edgeType).toBe(edgeType);
        } else {
          expect(edge).toBeUndefined();
        }
      }
    }

    test("base case", async () => {
      for (const edgeType of edgeTypes) {
        const edge = await loadEdgeForID2({
          id1: user1.id,
          id2: user2.id,
          edgeType,
          ctr: AssocEdge,
        });
        expect(edge).toBeUndefined();
      }

      // TODO should be able to do empty map here
      const builder = getUserEditBuilder(user1, new Map([["foo", "bar2"]]));

      // let's manually do edge1 and then we'll set separate edges...
      builder.orchestrator.addOutboundEdge(user2.id, "edge1", user2.nodeType);
      await builder.saveX();

      const edge = await loadEdgeForID2({
        id1: user1.id,
        id2: user2.id,
        edgeType: "edge1",
        ctr: AssocEdge,
      });
      expect(edge).toBeDefined();
      expect(edge?.id1).toBe(user1.id);
      expect(edge?.id2).toBe(user2.id);
      expect(edge?.edgeType).toBe("edge1");
      expect(edge?.data).toBeNull();

      for (const edgeType of edgeTypes) {
        const builder2 = getUserEditBuilder(user1, new Map([["foo", "bar2"]]));
        // set each edge
        await setEdgeTypeInGroup(
          builder2.orchestrator,
          edgeType + "Enum",
          user1.id,
          user2.id,
          "User",
          m,
        );
        await builder2.saveX();
        // verify said edge is set and others unset
        await verifyEdges(edgeTypes, edgeType);
      }
    });

    test("add data afterwards to existing edge", async () => {
      const builder = getUserEditBuilder(user1, new Map([["foo", "bar2"]]));

      // let's manually do edge1
      builder.orchestrator.addOutboundEdge(user2.id, "edge1", user2.nodeType);
      await builder.saveX();

      const builder2 = getUserEditBuilder(user1, new Map([["foo", "bar2"]]));
      // set each edge
      await setEdgeTypeInGroup(
        builder2.orchestrator,
        "edge1" + "Enum",
        user1.id,
        user2.id,
        "User",
        m,
      );
      const edgeInputs = builder2.orchestrator.getInputEdges(
        "edge1",
        WriteOperation.Insert,
      );
      expect(edgeInputs.length).toBe(1);

      edgeInputs.forEach((input) =>
        builder2.orchestrator.addOutboundEdge(
          input.id,
          input.edgeType,
          input.nodeType!,
          {
            data: "data!",
          },
        ),
      );

      await builder2.saveX();

      const edge = await loadEdgeForID2({
        id1: user1.id,
        id2: user2.id,
        edgeType: "edge1",
        ctr: AssocEdge,
      });
      expect(edge).toBeDefined();
      expect(edge?.id1).toBe(user1.id);
      expect(edge?.id2).toBe(user2.id);
      expect(edge?.edgeType).toBe("edge1");
      expect(edge?.data).toBe("data!");
    });
  });
}
