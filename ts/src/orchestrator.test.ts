import { Builder, WriteOperation } from "./action";
import {
  Ent,
  DataOperation,
  EditNodeOperation,
  DeleteNodeOperation,
  EdgeOperation,
  AssocEdgeData,
} from "./ent";
import * as ent from "./ent";
import { LoggedOutViewer } from "./viewer";
import { Changeset } from "./action";
import { StringType, TimeType } from "./field";
import { BaseEntSchema, Field } from "./schema";
import { IDViewer } from "../src/testutils/id_viewer";
import { User, SimpleBuilder, SimpleAction } from "./testutils/builder";
import { Pool } from "pg";
import { QueryRecorder } from "./testutils/db_mock";

jest.mock("pg");
QueryRecorder.mockPool(Pool);

afterEach(() => {
  QueryRecorder.clear();
});

// mock loadEdgeDatas and return a simple non-symmetric|non-inverse edge
// not sure if this is the best way but it's the only way I got
// long discussion about issues: https://github.com/facebook/jest/issues/936
jest.spyOn(ent, "loadEdgeDatas").mockImplementation(
  async (...edgeTypes: string[]): Promise<Map<string, AssocEdgeData>> => {
    if (!edgeTypes.length) {
      return new Map();
    }
    return new Map(
      edgeTypes.map((edgeType) => [
        edgeType,
        new AssocEdgeData({
          edge_table: "assoc_edge_config",
          symmetric_edge: false,
          inverse_edge_type: null,
          edge_type: edgeType,
          edge_name: "name",
        }),
      ]),
    );
  },
);

class UserSchema extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
  ];
}

class SchemaWithProcessors extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "zip" }).match(/^\d{5}(-\d{4})?$/),
    StringType({ name: "username" }).toLowerCase(),
  ];
}

test("schema on create", async () => {
  const builder = new SimpleBuilder(
    UserSchema,
    new Map([
      ["FirstName", "Jon"],
      ["LastName", "Snow"],
    ]),
  );

  const fields = await getFieldsFromBuilder(builder);
  expect(fields["first_name"]).toBe("Jon");
  expect(fields["last_name"]).toBe("Snow");
  validateFieldsExist(fields, "id", "created_at", "updated_at");
});

test("missing required field", async () => {
  const builder = new SimpleBuilder(
    UserSchema,
    new Map([
      ["FirstName", "Jon"],
      // non-nullable field set to null
      // simulating what the generated builder will do
      ["LastName", null],
    ]),
  );

  try {
    await builder.build();
    fail("should have thrown exception");
  } catch (e) {
    expect(e.message).toBe("field LastName set to null for non-nullable field");
  }
});

// if somehow builder logic doesn't handle this, we still catch this for create
// should this be default and simplify builders?
test("required field not set", async () => {
  const builder = new SimpleBuilder(
    UserSchema,
    new Map([["FirstName", "Jon"]]),
  );

  try {
    await builder.build();
    fail("should have thrown exception");
  } catch (e) {
    expect(e.message).toBe("required field LastName not set");
  }
});

test("schema on edit", async () => {
  const user = new User(new LoggedOutViewer(), "1", { id: "1" });
  const builder = new SimpleBuilder(
    UserSchema,
    // field that's not changed isn't set...
    // simulating what the generated builder will do
    new Map([["LastName", "Targaryean"]]),
    WriteOperation.Edit,
    user,
  );

  const fields = await getFieldsFromBuilder(builder);
  expect(fields["last_name"]).toBe("Targaryean");
  validateFieldsExist(fields, "updated_at");
  validateFieldsDoNotExist(fields, "id", "created_at");
});

test("schema on delete", async () => {
  const user = new User(new LoggedOutViewer(), "1", { id: "1" });
  const builder = new SimpleBuilder(
    UserSchema,
    new Map(),
    WriteOperation.Delete,
    user,
  );

  const c = await builder.build();
  const ops = getOperations(c);
  expect(ops.length).toBe(1);
  expect(ops[0]).toBeInstanceOf(DeleteNodeOperation);
});

test("schema with null fields", async () => {
  class SchemaWithNullFields extends BaseEntSchema {
    fields: Field[] = [
      TimeType({ name: "startTime" }),
      TimeType({ name: "endTime", nullable: true }),
    ];
  }

  const builder = new SimpleBuilder(
    SchemaWithNullFields,
    new Map([["startTime", new Date()]]),
  );

  const fields = await getFieldsFromBuilder(builder);
  expect(fields["start_time"]).toBeInstanceOf(Date);
  validateFieldsExist(fields, "id", "created_at", "updated_at");
  validateFieldsDoNotExist(fields, "end_time");

  const builder2 = new SimpleBuilder(
    SchemaWithNullFields,
    new Map([
      ["startTime", new Date()],
      ["endTime", null],
    ]),
  );
  const fields2 = await getFieldsFromBuilder(builder2);
  expect(fields2["start_time"]).toBeInstanceOf(Date);
  expect(fields2["end_time"]).toBe(null);

  validateFieldsExist(fields2, "id", "created_at", "updated_at");
});

test("schema_with_overriden_storage_key", async () => {
  class SchemaWithOverridenDBKey extends BaseEntSchema {
    fields: Field[] = [
      StringType({ name: "emailAddress", storageKey: "email" }),
    ];
  }

  const builder = new SimpleBuilder(
    SchemaWithOverridenDBKey,
    new Map([["emailAddress", "test@email.com"]]),
  );

  const fields = await getFieldsFromBuilder(builder);
  expect(fields["email"]).toBe("test@email.com");
  validateFieldsExist(fields, "id", "created_at", "updated_at");
});

describe("schema_with_processors", () => {
  test("simple case", async () => {
    const builder = new SimpleBuilder(
      SchemaWithProcessors,
      new Map([
        ["username", "lolopinto"],
        ["zip", "94114"],
      ]),
    );

    const fields = await getFieldsFromBuilder(builder);
    expect(fields["username"]).toBe("lolopinto");
    expect(fields["zip"]).toBe("94114");
    validateFieldsExist(fields, "id", "created_at", "updated_at");
  });

  test("username lowered", async () => {
    const builder = new SimpleBuilder(
      SchemaWithProcessors,
      new Map([
        ["username", "LOLOPINTO"],
        ["zip", "94114"],
      ]),
    );

    const fields = await getFieldsFromBuilder(builder);
    expect(fields["username"]).toBe("lolopinto");
    expect(fields["zip"]).toBe("94114");
    validateFieldsExist(fields, "id", "created_at", "updated_at");
  });

  test("invalid zip", async () => {
    const builder = new SimpleBuilder(
      SchemaWithProcessors,
      new Map([
        ["username", "LOLOPINTO"],
        ["zip", "941"],
      ]),
    );

    try {
      await builder.build();
      fail("should not have gotten here");
    } catch (e) {
      expect(e.message).toBe("invalid field zip with value 941");
    }
  });
});

test("inbound edge", async () => {
  const viewer = new IDViewer("1");
  const user = new User(viewer, "1", { id: "1" });
  const builder = new SimpleBuilder(
    UserSchema,
    new Map(),
    WriteOperation.Edit,
    user, // TODO enforce existing ent if not create
  );
  builder.viewer = viewer;
  builder.orchestrator.addInboundEdge("2", "edge", "User");

  const edgeOp = await getEdgeOpFromBuilder(builder, 2, "edge");
  expect(edgeOp.edgeInput).toStrictEqual({
    id1: "2",
    id1Type: "User",
    edgeType: "edge",
    id2: "1",
    id2Type: "User",
  });
});

test("outbound edge", async () => {
  const viewer = new IDViewer("1");
  const user = new User(viewer, "1", { id: "1" });
  const builder = new SimpleBuilder(
    UserSchema,
    new Map(),
    WriteOperation.Edit,
    user, // TODO enforce existing ent if not create
  );
  builder.viewer = viewer;
  builder.orchestrator.addOutboundEdge("2", "edge", "User");

  const edgeOp = await getEdgeOpFromBuilder(builder, 2, "edge");
  expect(edgeOp.edgeInput).toStrictEqual({
    id1: "1",
    id1Type: "User",
    edgeType: "edge",
    id2: "2",
    id2Type: "User",
  });
});

describe("remove inbound edge", () => {
  test("existing ent", async () => {
    const viewer = new IDViewer("1");
    const user = new User(viewer, "1", { id: "1" });
    const builder = new SimpleBuilder(
      UserSchema,
      new Map(),
      WriteOperation.Edit,
      user, // TODO enforce existing ent if not create
    );
    builder.viewer = viewer;
    builder.orchestrator.removeInboundEdge("2", "edge");

    const edgeOp = await getEdgeOpFromBuilder(builder, 2, "edge");
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
      UserSchema,
      new Map(),
      WriteOperation.Edit,
    );

    try {
      builder.orchestrator.removeInboundEdge("2", "edge");
      fail("should not get here");
    } catch (e) {
      expect(e.message).toBe("cannot remove an edge from a non-existing ent");
    }
  });
});

describe("remove outbound edge", () => {
  test("existing ent", async () => {
    const viewer = new IDViewer("1");
    const user = new User(viewer, "1", { id: "1" });
    const builder = new SimpleBuilder(
      UserSchema,
      new Map(),
      WriteOperation.Edit,
      user, // TODO enforce existing ent if not create
    );
    builder.viewer = viewer;
    builder.orchestrator.removeOutboundEdge("2", "edge");

    const edgeOp = await getEdgeOpFromBuilder(builder, 2, "edge");
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
      UserSchema,
      new Map(),
      WriteOperation.Edit,
    );

    try {
      builder.orchestrator.removeOutboundEdge("2", "edge");
      fail("should not get here");
    } catch (e) {
      expect(e.message).toBe("cannot remove an edge from a non-existing ent");
    }
  });
});

describe("validators", () => {
  class EventSchema extends BaseEntSchema {
    fields: Field[] = [
      TimeType({ name: "startTime" }),
      TimeType({ name: "endTime" }),
    ];
  }

  const validators = [
    {
      validate: async (builder: SimpleBuilder): Promise<void> => {
        // console.log. not even getting here.
        // time to mock/spy everything here similar to what we're doing in action.test.ts
        let startTime: Date = builder.fields.get("startTime");
        let endTime: Date = builder.fields.get("endTime");

        if (!startTime || !endTime) {
          throw new Error("startTime and endTime required");
        }

        if (startTime.getTime() > endTime.getTime()) {
          throw new Error("start time cannot be after end time");
        }
      },
    },
  ];

  test("invalid", async () => {
    let now = new Date();
    let yesterday = new Date(now.getTime() - 86400);

    let action = new SimpleAction(
      EventSchema,
      new Map([
        ["startTime", now],
        ["endTime", yesterday],
      ]),
      WriteOperation.Insert,
    );
    action.validators = validators;

    try {
      await action.validX();
      fail("should have thrown exception");
    } catch (e) {
      expect(e.message).toBe("start time cannot be after end time");
    }
  });

  test("valid", async () => {
    let now = new Date();
    let yesterday = new Date(now.getTime() - 86400);

    let action = new SimpleAction(
      EventSchema,
      new Map([
        ["startTime", yesterday],
        ["endTime", now],
      ]),
      WriteOperation.Insert,
    );
    action.validators = validators;

    await action.validX();

    // can "save" the query!
    await action.saveX();
  });
});

function validateFieldsExist(fields: {}, ...names: string[]) {
  for (const name of names) {
    expect(fields[name], `field ${name}`).not.toBe(undefined);
  }
}

function validateFieldsDoNotExist(fields: {}, ...names: string[]) {
  for (const name of names) {
    expect(fields[name], `field ${name}`).toBe(undefined);
  }
}

function getOperations<T extends Ent>(c: Changeset<T>): DataOperation<T>[] {
  let ops: DataOperation<T>[] = [];
  for (let op of c.executor()) {
    ops.push(op);
  }
  return ops;
}

async function getFieldsFromBuilder<T extends Ent>(
  builder: Builder<T>,
  expLength: number = 1,
): Promise<{}> {
  const c = await builder.build();
  const ops = getOperations(c);
  expect(ops.length).toBe(expLength);
  for (const op of ops) {
    const options = (op as EditNodeOperation<T>).options;
    if (options !== undefined) {
      return options.fields;
    }
  }
  fail("couldn't find EditNodeOperation where fields are being edited");
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
  fail(`could not find edge operation with edgeType ${edgeType}`);
}
