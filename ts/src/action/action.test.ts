import { WriteOperation } from ".";
import { User, BuilderSchema, SimpleBuilder } from "../testutils/builder";
import { IDViewer, LoggedOutViewer } from "../core/viewer";
import { Pool } from "pg";
import { QueryRecorder, queryType } from "../testutils/db_mock";
import { Field, StringType, UUIDType } from "../schema";
import { createRowForTest } from "../testutils/write";
import { AssocEdge, loadEdgeForID2 } from "../core/ent";
import { setEdgeTypeInGroup } from "./action";

jest.mock("pg");
QueryRecorder.mockPool(Pool);

afterEach(() => {
  QueryRecorder.clear();
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
      },
    });
  }
}

beforeEach(async () => {
  // does assoc_edge_config loader need to be cleared?
  const edges = ["edge"];
  await createEdgeRows(["edge"]);
  QueryRecorder.clearQueries();
});

test("simple", async () => {
  const builder = getUserCreateBuilder();

  await builder.saveX();
  let ent = await builder.editedEntX();
  QueryRecorder.validateQueriesInTx(
    [
      {
        query: "INSERT INTO users (id, foo) VALUES ($1, $2) RETURNING *",
        values: ["{id}", "bar"],
      },
    ],
    ent,
  );
});

test("new ent with edge", async () => {
  const builder = getUserCreateBuilder();
  const id2 = QueryRecorder.newID();
  builder.orchestrator.addOutboundEdge(id2, "edge", "User");
  await builder.saveX();

  QueryRecorder.validateQueryStructuresInTx([
    {
      tableName: "users",
      type: queryType.INSERT,
    },
    {
      tableName: "edge_table",
      type: queryType.INSERT,
    },
  ]);
});

test("existing ent with edge", async () => {
  const user = await createUser();

  const builder = getUserEditBuilder(user, new Map([["foo", "bar"]]));
  const id2 = QueryRecorder.newID();

  builder.orchestrator.addOutboundEdge(id2, "edge", "User");
  await builder.saveX();

  QueryRecorder.validateQueryStructuresInTx(
    [
      {
        tableName: "users",
        type: queryType.UPDATE,
      },
      {
        tableName: "edge_table",
        type: queryType.INSERT,
      },
    ],
    [
      {
        type: queryType.BEGIN,
      },
      {
        tableName: "users",
        type: queryType.INSERT,
      },
      {
        type: queryType.COMMIT,
      },
    ],
  );
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
  QueryRecorder.validateFailedQueryStructuresInTx([
    {
      tableName: "users",
      type: queryType.INSERT,
    },
  ]);
});

describe("setEdgeTypeInGroup", () => {
  const edgeTypes = ["edge1", "edge2", "edge3"];
  let user1, user2: User;
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
