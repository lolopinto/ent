import { Builder, WriteOperation } from "../action";
import { Ent, Viewer } from "../core/base";
import { DataOperation, EdgeOperation, loadEdges, loadRow } from "../core/ent";
import { LoggedOutViewer, IDViewer } from "../core/viewer";
import { Changeset } from "../action";
import { StringType } from "../schema/field";
import {
  User,
  SimpleBuilder,
  SimpleAction,
  getBuilderSchemaFromFields,
} from "../testutils/builder";
import { FakeComms } from "../testutils/fake_comms";
import { Pool } from "pg";
import { QueryRecorder } from "../testutils/db_mock";
import { edgeDirection } from "./orchestrator";
import { createRowForTest } from "../testutils/write";
import * as clause from "../core/clause";
import { snakeCase } from "snake-case";
import {
  assoc_edge_config_table,
  assoc_edge_table,
  getSchemaTable,
  setupSqlite,
  Table,
} from "../testutils/db/temp_db";
import { Dialect } from "../core/db";

jest.mock("pg");
QueryRecorder.mockPool(Pool);

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

    [UserSchema].map((s) => tables.push(getSchemaTable(s, Dialect.SQLite)));

    return tables;
  };

  setupSqlite(`sqlite:///orchestrator-edge-test.db`, getTables);
  commonTests();
});

const UserSchema = getBuilderSchemaFromFields(
  {
    FirstName: StringType(),
    LastName: StringType(),
  },
  User,
);

const getLoggedInBuilder = () => {
  const viewer = new IDViewer("1");
  const user = new User(viewer, { id: "1" });
  return new SimpleBuilder(
    viewer,
    UserSchema,
    new Map(),
    WriteOperation.Edit,
    user, // TODO enforce existing ent if not create
  );
};

function getOperations(c: Changeset): DataOperation[] {
  let ops: DataOperation[] = [];
  for (let op of c.executor()) {
    ops.push(op);
  }
  return ops;
}

async function getEdgeOpFromBuilder<T extends Ent>(
  builder: Builder<T>,
  expLength: number,
  edgeType: string,
): Promise<EdgeOperation> {
  const c = await builder.build();
  const ops = getOperations(c);
  expect(ops.length).toBe(expLength);
  //  console.log(ops);
  for (const op of ops) {
    if ((op as EdgeOperation).edgeInput !== undefined) {
      //      console.log(op);
      // todo add more things to differentiate this by
      const edgeOp = (op as EdgeOperation)!;
      if (edgeOp.edgeInput.edgeType === edgeType) {
        return edgeOp;
      }
    }
  }
  throw new Error(`could not find edge operation with edgeType ${edgeType}`);
}

function getInsertUserAction(
  map: Map<string, any>,
  viewer: Viewer = new LoggedOutViewer(),
) {
  return new SimpleAction(viewer, UserSchema, map, WriteOperation.Insert, null);
}

const getCreateBuilder = (map: Map<string, any>) => {
  return new SimpleBuilder(
    new LoggedOutViewer(),
    UserSchema,
    map,
    WriteOperation.Insert,
    null,
  );
};

const createUser = async (map: Map<string, any>): Promise<User> => {
  const builder = getCreateBuilder(map);

  //  const
  await builder.saveX();
  return builder.editedEntX();
};

function commonTests() {
  describe("inbound edge", () => {
    test("no options", async () => {
      const builder = getLoggedInBuilder();
      builder.orchestrator.addInboundEdge("2", "edge", "User");

      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.inboundEdge,
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      const edgeOp = await getEdgeOpFromBuilder(builder, 3, "edge");
      expect(edgeOp.edgeInput).toStrictEqual({
        id1: "2",
        id1Type: "User",
        edgeType: "edge",
        id2: "1",
        id2Type: "User",
      });
    });

    test("no id. creating. no options", async () => {
      const builder = getCreateBuilder(
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
      );
      builder.orchestrator.addInboundEdge("2", "edge", "User");

      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.inboundEdge,
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      const edgeOp = await getEdgeOpFromBuilder(builder, 3, "edge");
      expect(edgeOp.edgeInput).toStrictEqual({
        id1: "2",
        id1Type: "User",
        edgeType: "edge",
        id2: builder.placeholderID,
        id2Type: "",
      });
    });

    test("no options then add options", async () => {
      const builder = getLoggedInBuilder();
      builder.orchestrator.addInboundEdge("2", "edge", "User");

      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.inboundEdge,
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      builder.orchestrator.addInboundEdge("2", "edge", "User", {
        data: "123456",
      });
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.inboundEdge,
            options: {
              data: "123456",
            },
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      const edgeOp = await getEdgeOpFromBuilder(builder, 3, "edge");
      expect(edgeOp.edgeInput).toStrictEqual({
        id1: "2",
        id1Type: "User",
        edgeType: "edge",
        id2: "1",
        id2Type: "User",
        data: "123456",
      });
    });

    test("no id. creating. no options, then add options", async () => {
      const builder = getCreateBuilder(
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
      );
      builder.orchestrator.addInboundEdge("2", "edge", "User");

      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.inboundEdge,
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      builder.orchestrator.addInboundEdge("2", "edge", "User", {
        data: "123456",
      });
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.inboundEdge,
            options: {
              data: "123456",
            },
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      const edgeOp = await getEdgeOpFromBuilder(builder, 3, "edge");
      expect(edgeOp.edgeInput).toStrictEqual({
        id1: "2",
        id1Type: "User",
        edgeType: "edge",
        id2: builder.placeholderID,
        id2Type: "",
        data: "123456",
      });
    });

    test("options then diff options", async () => {
      const builder = getLoggedInBuilder();
      builder.orchestrator.addInboundEdge("2", "edge", "User", {
        data: "123456",
      });

      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.inboundEdge,
            options: {
              data: "123456",
            },
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      let date = new Date();
      builder.orchestrator.addInboundEdge("2", "edge", "User", {
        data: "123456",
        time: date,
      });
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.inboundEdge,
            options: {
              data: "123456",
              time: date,
            },
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      const edgeOp = await getEdgeOpFromBuilder(builder, 3, "edge");
      expect(edgeOp.edgeInput).toStrictEqual({
        id1: "2",
        id1Type: "User",
        edgeType: "edge",
        id2: "1",
        id2Type: "User",
        data: "123456",
        time: date,
      });
    });

    test("no id. creating. options, then diff options", async () => {
      const builder = getCreateBuilder(
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
      );
      builder.orchestrator.addInboundEdge("2", "edge", "User", {
        data: "123456",
      });

      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.inboundEdge,
            options: {
              data: "123456",
            },
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      // NOTE: data wasn't set in re-adding so it's removed...
      let date = new Date();
      builder.orchestrator.addInboundEdge("2", "edge", "User", {
        time: date,
      });
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.inboundEdge,
            options: {
              time: date,
            },
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      const edgeOp = await getEdgeOpFromBuilder(builder, 3, "edge");
      expect(edgeOp.edgeInput).toStrictEqual({
        id1: "2",
        id1Type: "User",
        edgeType: "edge",
        id2: builder.placeholderID,
        id2Type: "",
        time: date,
      });
    });

    test("id in data field with placeholder", async () => {
      // create user1
      const user = await createUser(
        new Map([
          ["FirstName", "Arya"],
          ["LastName", "Stark"],
        ]),
      );

      const action = getInsertUserAction(
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
      );
      action.builder.orchestrator.addInboundEdge(user.id, "edge", "User");
      action.getTriggers = () => [
        {
          changeset: (builder: SimpleBuilder<User>) => {
            const derivedAction = getInsertUserAction(
              new Map([
                ["FirstName", "Sansa"],
                ["LastName", "Stark"],
              ]),
            );

            // take the edges and write it as 3 edge
            const edges = builder.orchestrator.getInputEdges(
              "edge",
              WriteOperation.Insert,
            );
            edges.forEach((edge) => {
              builder.orchestrator.addInboundEdge(
                edge.id,
                edge.edgeType,
                edge.nodeType!,
                {
                  data: derivedAction.builder,
                },
              );
            });

            return derivedAction.changeset();
          },
        },
      ];

      const newUser = await action.saveX();
      expect(newUser).toBeInstanceOf(User);
      if (!newUser) {
        throw new Error("impossible");
      }

      const edges = await loadEdges({
        id1: user.id,
        edgeType: "edge",
      });
      expect(edges.length).toBe(1);
      const edge = edges[0];
      expect(edge.id1).toBe(user.id);
      expect(edge.id2).toBe(newUser.id);
      expect(edge.data).not.toBeNull();

      // we were able to resolve the id correctly and then set it as needed
      const sansaData = await loadRow({
        tableName: "users",
        fields: ["first_name", "last_name"],
        clause: clause.Eq("id", edge.data),
      });
      expect(sansaData).toBeDefined();
      expect(sansaData?.first_name).toBe("Sansa");
      expect(sansaData?.last_name).toBe("Stark");

      const inverseEdges = await loadEdges({
        id1: newUser.id,
        edgeType: "inverseEdge",
      });
      expect(inverseEdges.length).toBe(1);
      expect(inverseEdges[0].data).toBe(edge.data);
    });

    test("id in data field symmetric edge", async () => {
      // create user1
      const user = await createUser(
        new Map([
          ["FirstName", "Arya"],
          ["LastName", "Stark"],
        ]),
      );

      const action = getInsertUserAction(
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
      );
      action.builder.orchestrator.addInboundEdge(
        user.id,
        "symmetricEdge",
        "User",
      );
      action.getTriggers = () => [
        {
          changeset: (builder: SimpleBuilder<User>) => {
            const derivedAction = getInsertUserAction(
              new Map([
                ["FirstName", "Sansa"],
                ["LastName", "Stark"],
              ]),
            );

            // take the edges and write it as 3 edge
            const edges = builder.orchestrator.getInputEdges(
              "symmetricEdge",
              WriteOperation.Insert,
            );
            edges.forEach((edge) => {
              builder.orchestrator.addInboundEdge(
                edge.id,
                edge.edgeType,
                edge.nodeType!,
                {
                  data: derivedAction.builder,
                },
              );
            });

            return derivedAction.changeset();
          },
        },
      ];

      const newUser = await action.saveX();
      expect(newUser).toBeInstanceOf(User);
      if (!newUser) {
        throw new Error("impossible");
      }

      const edges = await loadEdges({
        id1: user.id,
        edgeType: "symmetricEdge",
      });
      expect(edges.length).toBe(1);
      const edge = edges[0];
      expect(edge.id1).toBe(user.id);
      expect(edge.id2).toBe(newUser.id);
      expect(edge.data).not.toBeNull();

      // we were able to resolve the id correctly and then set it as needed
      const sansaData = await loadRow({
        tableName: "users",
        fields: ["first_name", "last_name"],
        clause: clause.Eq("id", edge.data),
      });
      expect(sansaData).toBeDefined();
      expect(sansaData?.first_name).toBe("Sansa");
      expect(sansaData?.last_name).toBe("Stark");

      const inverseEdges = await loadEdges({
        id1: newUser.id,
        edgeType: "symmetricEdge",
      });
      expect(inverseEdges.length).toBe(1);
      expect(inverseEdges[0].data).toBe(edge.data);
    });
  });

  describe("outbound edge", () => {
    test("no options", async () => {
      const builder = getLoggedInBuilder();
      builder.orchestrator.addOutboundEdge("2", "edge", "User");

      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.outboundEdge,
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      // 3 ops, edit, outbound, inverse
      const edgeOp = await getEdgeOpFromBuilder(builder, 3, "edge");
      expect(edgeOp.edgeInput).toStrictEqual({
        id1: "1",
        id1Type: "User",
        edgeType: "edge",
        id2: "2",
        id2Type: "User",
      });
    });

    test("no id. creating. no options", async () => {
      const builder = getCreateBuilder(
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
      );
      builder.orchestrator.addOutboundEdge("2", "edge", "User");

      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.outboundEdge,
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      // 3 ops, create, outbound, inverse
      const edgeOp = await getEdgeOpFromBuilder(builder, 3, "edge");
      expect(edgeOp.edgeInput).toStrictEqual({
        id1: builder.placeholderID,
        id1Type: "",
        id2: "2",
        id2Type: "User",
        edgeType: "edge",
      });
    });

    test("no options then add options", async () => {
      const builder = getLoggedInBuilder();
      builder.orchestrator.addOutboundEdge("2", "edge", "User");

      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.outboundEdge,
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      builder.orchestrator.addOutboundEdge("2", "edge", "User", {
        data: "123456",
      });
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.outboundEdge,
            options: {
              data: "123456",
            },
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      const edgeOp = await getEdgeOpFromBuilder(builder, 3, "edge");
      expect(edgeOp.edgeInput).toStrictEqual({
        id1: "1",
        id1Type: "User",
        edgeType: "edge",
        id2: "2",
        id2Type: "User",
        data: "123456",
      });
    });

    test("no id. creating. no options, then add options", async () => {
      const builder = getCreateBuilder(
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
      );
      builder.orchestrator.addOutboundEdge("2", "edge", "User");

      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.outboundEdge,
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      builder.orchestrator.addOutboundEdge("2", "edge", "User", {
        data: "123456",
      });
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.outboundEdge,
            options: {
              data: "123456",
            },
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      // 3 ops, edit, outbound, inverse
      const edgeOp = await getEdgeOpFromBuilder(builder, 3, "edge");
      expect(edgeOp.edgeInput).toStrictEqual({
        id2: "2",
        id2Type: "User",
        edgeType: "edge",
        id1: builder.placeholderID,
        id1Type: "",
        data: "123456",
      });
    });

    test("options then diff options", async () => {
      const builder = getLoggedInBuilder();
      builder.orchestrator.addOutboundEdge("2", "edge", "User", {
        data: "123456",
      });

      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.outboundEdge,
            options: {
              data: "123456",
            },
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      let date = new Date();
      builder.orchestrator.addOutboundEdge("2", "edge", "User", {
        data: "123456",
        time: date,
      });
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.outboundEdge,
            options: {
              data: "123456",
              time: date,
            },
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      // 3 ops, edit, outbound, inverse
      const edgeOp = await getEdgeOpFromBuilder(builder, 3, "edge");
      expect(edgeOp.edgeInput).toStrictEqual({
        id1: "1",
        id1Type: "User",
        edgeType: "edge",
        id2: "2",
        id2Type: "User",
        data: "123456",
        time: date,
      });
    });

    test("no id. creating. options, then diff options", async () => {
      const builder = getCreateBuilder(
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
      );
      builder.orchestrator.addOutboundEdge("2", "edge", "User", {
        data: "123456",
      });

      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.outboundEdge,
            options: {
              data: "123456",
            },
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      // NOTE: data wasn't set in re-adding so it's removed...
      let date = new Date();
      builder.orchestrator.addOutboundEdge("2", "edge", "User", {
        time: date,
      });
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            nodeType: "User",
            direction: edgeDirection.outboundEdge,
            options: {
              time: date,
            },
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual([]);

      // 3 ops, edit, outbound, inverse
      const edgeOp = await getEdgeOpFromBuilder(builder, 3, "edge");
      expect(edgeOp.edgeInput).toStrictEqual({
        id2: "2",
        id2Type: "User",
        edgeType: "edge",
        id1: builder.placeholderID,
        id1Type: "",
        time: date,
      });
    });

    test("id in data field with placeholder", async () => {
      // create user1
      const user = await createUser(
        new Map([
          ["FirstName", "Arya"],
          ["LastName", "Stark"],
        ]),
      );

      const action = getInsertUserAction(
        new Map([
          ["FirstName", "Jon"],
          ["LastName", "Snow"],
        ]),
      );
      action.builder.orchestrator.addOutboundEdge(user.id, "edge", "User");
      action.getTriggers = () => [
        {
          changeset: (builder: SimpleBuilder<User>) => {
            const derivedAction = getInsertUserAction(
              new Map([
                ["FirstName", "Sansa"],
                ["LastName", "Stark"],
              ]),
            );

            // take the edges and write it as 3 edge
            const edges = builder.orchestrator.getInputEdges(
              "edge",
              WriteOperation.Insert,
            );
            edges.forEach((edge) => {
              builder.orchestrator.addOutboundEdge(
                edge.id,
                edge.edgeType,
                edge.nodeType!,
                {
                  data: derivedAction.builder,
                },
              );
            });

            return derivedAction.changeset();
          },
        },
      ];

      const newUser = await action.saveX();
      expect(newUser).toBeInstanceOf(User);
      if (!newUser) {
        throw new Error("impossible");
      }

      const edges = await loadEdges({
        id1: newUser.id,
        edgeType: "edge",
      });
      expect(edges.length).toBe(1);
      const edge = edges[0];
      expect(edge.id1).toBe(newUser.id);
      expect(edge.id2).toBe(user.id);
      expect(edge.data).toBeDefined();

      // we were able to resolve the id correctly and then set it as needed
      const sansaData = await loadRow({
        tableName: "users",
        fields: ["first_name", "last_name"],
        clause: clause.Eq("id", edge.data),
      });
      expect(sansaData).not.toBeNull();
      expect(sansaData?.first_name).toBe("Sansa");
      expect(sansaData?.last_name).toBe("Stark");

      // load inverse
      const inverseEdges = await loadEdges({
        id1: user.id,
        edgeType: "inverseEdge",
      });
      expect(inverseEdges.length).toBe(1);
      const inverseEdge = inverseEdges[0];
      expect(inverseEdge.data).toBe(edge.data);
    });
  });

  test("id in data field symmetric edge", async () => {
    const user = await createUser(
      new Map([
        ["FirstName", "Arya"],
        ["LastName", "Stark"],
      ]),
    );

    const action = getInsertUserAction(
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
    );
    action.builder.orchestrator.addOutboundEdge(
      user.id,
      "symmetricEdge",
      "User",
    );
    action.getTriggers = () => [
      {
        changeset: (builder: SimpleBuilder<User>) => {
          const derivedAction = getInsertUserAction(
            new Map([
              ["FirstName", "Sansa"],
              ["LastName", "Stark"],
            ]),
          );

          // take the edges and write it as 3 edge
          const edges = builder.orchestrator.getInputEdges(
            "symmetricEdge",
            WriteOperation.Insert,
          );
          edges.forEach((edge) => {
            builder.orchestrator.addOutboundEdge(
              edge.id,
              edge.edgeType,
              edge.nodeType!,
              {
                data: derivedAction.builder,
              },
            );
          });

          return derivedAction.changeset();
        },
      },
    ];

    const newUser = await action.saveX();
    expect(newUser).toBeInstanceOf(User);
    if (!newUser) {
      throw new Error("impossible");
    }

    const edges = await loadEdges({
      id1: user.id,
      edgeType: "symmetricEdge",
    });
    expect(edges.length).toBe(1);
    const edge = edges[0];
    expect(edge.id1).toBe(user.id);
    expect(edge.id2).toBe(newUser.id);
    expect(edge.data).not.toBeNull();

    // we were able to resolve the id correctly and then set it as needed
    const sansaData = await loadRow({
      tableName: "users",
      fields: ["first_name", "last_name"],
      clause: clause.Eq("id", edge.data),
    });
    expect(sansaData).toBeDefined();
    expect(sansaData?.first_name).toBe("Sansa");
    expect(sansaData?.last_name).toBe("Stark");

    const inverseEdges = await loadEdges({
      id1: newUser.id,
      edgeType: "symmetricEdge",
    });
    expect(inverseEdges.length).toBe(1);
    expect(inverseEdges[0].data).toBe(edge.data);
  });

  test("multi-ids then take and add to other edge", async () => {
    const builder = getLoggedInBuilder();
    let ids = ["2", "3", "4", "5", "6", "7", "8", "9", "10"];
    let expEdges: any[] = [];
    let otherExpEdges: any[] = [];

    ids.forEach((id) => {
      builder.orchestrator.addOutboundEdge(id, "edge", "User");
      expEdges.push(
        expect.objectContaining({
          id: id,
          edgeType: "edge",
          nodeType: "User",
          direction: edgeDirection.outboundEdge,
        }),
      );

      otherExpEdges.push(
        expect.objectContaining({
          id: id,
          edgeType: "otherEdge",
          nodeType: "User",
          direction: edgeDirection.outboundEdge,
        }),
      );
    });

    let edges = builder.orchestrator.getInputEdges(
      "edge",
      WriteOperation.Insert,
    );
    expect(edges).toEqual(expect.arrayContaining(expEdges));

    expect(
      builder.orchestrator.getInputEdges("otherEdge", WriteOperation.Insert),
    ).toEqual([]);

    edges.forEach((edge) => {
      builder.orchestrator.addOutboundEdge(
        edge.id,
        "otherEdge",
        edge.nodeType!,
      );
    });

    expect(
      builder.orchestrator.getInputEdges("otherEdge", WriteOperation.Insert),
    ).toEqual(expect.arrayContaining(otherExpEdges));

    // clears all the edges
    builder.orchestrator.clearInputEdges("edge", WriteOperation.Insert);
    expect(
      builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
    ).toEqual([]);

    // clear just one id "3"
    ids = ids.filter((id) => id != "3");
    builder.orchestrator.clearInputEdges(
      "otherEdge",
      WriteOperation.Insert,
      "3",
    );
    otherExpEdges = [];
    ids.forEach((id) => {
      otherExpEdges.push(
        expect.objectContaining({
          id: id,
          edgeType: "otherEdge",
          nodeType: "User",
          direction: edgeDirection.outboundEdge,
        }),
      );
    });
    expect(
      builder.orchestrator.getInputEdges("otherEdge", WriteOperation.Insert),
    ).toEqual(otherExpEdges);
  });

  describe("remove inbound edge", () => {
    test("existing ent", async () => {
      const viewer = new IDViewer("1");
      const user = new User(viewer, { id: "1" });
      const builder = new SimpleBuilder(
        viewer,
        UserSchema,
        new Map(),
        WriteOperation.Edit,
        user, // TODO enforce existing ent if not create
      );
      builder.orchestrator.removeInboundEdge("2", "edge");

      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            direction: edgeDirection.inboundEdge,
          }),
        ]),
      );
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual([]);

      const edgeOp = await getEdgeOpFromBuilder(builder, 3, "edge");
      expect(edgeOp.edgeInput).toStrictEqual({
        id1: "2",
        edgeType: "edge",
        id2: "1",
        id1Type: "", // not useful so we don't care
        id2Type: "",
      });
    });

    test("no ent", async () => {
      const builder = new SimpleBuilder(
        new LoggedOutViewer(),
        UserSchema,
        new Map(),
        WriteOperation.Edit,
        null,
      );
      builder.orchestrator.removeInboundEdge("2", "edge");

      try {
        await builder.build();

        throw new Error("should not get here");
      } catch (e) {
        expect(e.message).toBe("existing ent required with operation edit");
      }
    });
  });

  describe("remove outbound edge", () => {
    test("existing ent", async () => {
      const viewer = new IDViewer("1");
      const user = new User(viewer, { id: "1" });
      const builder = new SimpleBuilder(
        viewer,
        UserSchema,
        new Map(),
        WriteOperation.Edit,
        user, // TODO enforce existing ent if not create
      );
      builder.orchestrator.removeOutboundEdge("2", "edge");
      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Insert),
      ).toEqual([]);

      expect(
        builder.orchestrator.getInputEdges("edge", WriteOperation.Delete),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "2",
            edgeType: "edge",
            direction: edgeDirection.outboundEdge,
          }),
        ]),
      );

      const edgeOp = await getEdgeOpFromBuilder(builder, 3, "edge");
      expect(edgeOp.edgeInput).toStrictEqual({
        id1: "1",
        edgeType: "edge",
        id2: "2",
        id1Type: "", // not useful so we don't care
        id2Type: "",
      });
    });

    test("no ent", async () => {
      const builder = new SimpleBuilder(
        new LoggedOutViewer(),
        UserSchema,
        new Map(),
        WriteOperation.Edit,
        null,
      );
      builder.orchestrator.removeOutboundEdge("2", "edge");

      try {
        await builder.build();
        throw new Error("should not get here");
      } catch (e) {
        expect(e.message).toBe("existing ent required with operation edit");
      }
    });
  });
}
