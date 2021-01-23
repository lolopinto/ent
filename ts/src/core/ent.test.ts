import { WriteOperation } from "../action";
import { User, BuilderSchema, SimpleBuilder } from "../testutils/builder";
import { IDViewer, LoggedOutViewer } from "./viewer";
import { Pool } from "pg";
import { QueryRecorder, queryType } from "../testutils/db_mock";
import { Field, StringType, UUIDType } from "../schema";
import { createRowForTest } from "../testutils/write";
import { loadEdgeForID2, getEdgeTypeInGroup } from "../core/ent";

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
  return await builder.saveX();
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

test("getEdgeTypeInGroup", async () => {
  const edgeTypes = ["edge1", "edge2", "edge3"];
  let m = new Map<string, string>();
  for (const edgeType of edgeTypes) {
    m.set(edgeType + "Enum", edgeType);
  }

  await createEdgeRows(edgeTypes);
  const [user1, user2] = await Promise.all([createUser(), createUser()]);

  // nothing set yet
  const res1 = await getEdgeTypeInGroup(
    new IDViewer(user1.id),
    user1.id,
    user2.id,
    m,
  );
  expect(res1).toBeUndefined();

  // TODO should be able to do empty map here
  const builder = getUserEditBuilder(user1, new Map([["foo", "bar2"]]));

  // let's manually do edge1 and then we'll set separate edges...
  builder.orchestrator.addOutboundEdge(user2.id, "edge1", user2.nodeType);
  await builder.saveX();

  const res2 = await getEdgeTypeInGroup(
    new IDViewer(user1.id),
    user1.id,
    user2.id,
    m,
  );
  expect(res2).toBeDefined();
  expect(res2![0]).toBe("edge1Enum");
  const edge = res2![1];
  expect(edge).toBeDefined();
  expect(edge?.id1).toBe(user1.id);
  expect(edge?.id2).toBe(user2.id);
  expect(edge?.edgeType).toBe("edge1");

  async function verifyEdges(edgeSet: string) {
    const res = await getEdgeTypeInGroup(
      new IDViewer(user1.id),
      user1.id,
      user2.id,
      m,
    );
    expect(res).toBeDefined();
    expect(res![0]).toBe(edgeSet + "Enum");
    const edge = res![1];
    expect(edge).toBeDefined();
    expect(edge?.id1).toBe(user1.id);
    expect(edge?.id2).toBe(user2.id);
    expect(edge?.edgeType).toBe(edgeSet);
  }

  for (const edgeType of edgeTypes) {
    const builder2 = getUserEditBuilder(user1, new Map([["foo", "bar2"]]));

    for (const edgeType2 of edgeTypes) {
      if (edgeType === edgeType2) {
        builder2.orchestrator.addOutboundEdge(user2.id, edgeType2, "User");
      } else {
        builder2.orchestrator.removeOutboundEdge(user2.id, edgeType2);
      }
    }

    await builder2.saveX();
    // verify said edge is set and others unset
    await verifyEdges(edgeType);
  }
});
