import { WriteOperation } from ".";
import { User, BuilderSchema, SimpleBuilder } from "../testutils/builder";
import { IDViewer, LoggedOutViewer } from "../core/viewer";
import { Pool } from "pg";
import { QueryRecorder, queryType } from "../testutils/db_mock";
import { Field, StringType, UUIDType } from "../schema";
import { createRowForTest } from "../testutils/write";

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

function getCreateBuilder(): SimpleBuilder<User> {
  return new SimpleBuilder(
    viewer,
    schema,
    new Map([
      ["id", "{id}"],
      ["foo", "bar"],
    ]),
  );
}

beforeEach(async () => {
  // does assoc_edge_config loader need to be cleared?
  const edges = ["edge"];
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
  QueryRecorder.clearQueries();
});

test("simple", async () => {
  const builder = getCreateBuilder();

  let ent = await builder.saveX();
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
  const builder = getCreateBuilder();
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
  const builder = getCreateBuilder();

  let user = await builder.saveX();

  const builder2 = new SimpleBuilder(
    new IDViewer(user.id),
    schema,
    new Map([["foo", "bar"]]),
    WriteOperation.Edit,
    user,
  );
  const id2 = QueryRecorder.newID();

  builder2.orchestrator.addOutboundEdge(id2, "edge", "User");
  await builder2.saveX();

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
  const builder = getCreateBuilder();
  const builder2 = getCreateBuilder();
  builder.orchestrator.addOutboundEdge(builder2, "edge", "User");

  let ent: User | null = null;
  try {
    ent = await builder.saveX();
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
