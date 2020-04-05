import {
  saveBuilder,
  saveBuilderX,
  Builder,
  Changeset,
  WriteOperation,
  Executor,
} from "./action";
import { User } from "./testutils/builder";
import { Viewer, Ent, ID, DataOperation, Queryer } from "./ent";
import { EntChangeset, Orchestrator } from "./orchestrator";
import { LoggedOutViewer } from "./viewer";
import { v4 as uuidv4 } from "uuid";
import { Pool, PoolClient } from "pg";
import { mocked } from "ts-jest/utils";

const eventEmitter = {
  on: jest.fn(),
  addListener: jest.fn(),
  removeListener: jest.fn(),
  once: jest.fn(),
  off: jest.fn(),
  removeAllListeners: jest.fn(),
  setMaxListeners: jest.fn(),
  getMaxListeners: jest.fn(),
  listeners: jest.fn(),
  rawListeners: jest.fn(),
  emit: jest.fn(),
  listenerCount: jest.fn(),
  prependListener: jest.fn(),
  prependOnceListener: jest.fn(),
  eventNames: jest.fn(),
};

let queries: queryOptions[] = [];
function recordQuery(query: string, values: any[]) {
  //  console.log(query, values);

  queries.push({
    query: query,
    values: values,
  });
}

let ids: ID[] = [];
function newID(): ID {
  let id = uuidv4();
  ids.push(id);
  return id;
}

// clear after each query
afterEach(() => {
  queries = [];
  ids = [];
});

// TODO
process.env.DB_CONNECTION_STRING = "ss";
jest.mock("pg");

const mockedPool = mocked(Pool, true);
mockedPool.mockImplementation(
  (): Pool => {
    return {
      totalCount: 1,
      idleCount: 1,
      waitingCount: 1,
      connect: async (): Promise<PoolClient> => {
        return {
          connect: jest.fn(),
          release: jest.fn(),
          query: jest
            .fn()
            .mockImplementation((query: string, values: any[]) => {
              recordQuery(query, values);
            }),
          copyFrom: jest.fn(),
          copyTo: jest.fn(),
          pauseDrain: jest.fn(),
          resumeDrain: jest.fn(),
          escapeIdentifier: jest.fn(),
          escapeLiteral: jest.fn(),

          // EventEmitter
          ...eventEmitter,
        };
      },
      end: jest.fn(),
      query: jest.fn(),

      // EVentEmitter
      ...eventEmitter,
    };
  },
);

class FakeBuilder implements Builder<User> {
  ent = User;
  placeholderID = "1";
  viewer: Viewer;
  public orchestrator: Orchestrator<User>;

  private ops: DataOperation<any>[] = [];
  constructor(
    private fields: Map<string, any>,
    public operation: WriteOperation = WriteOperation.Insert,
    public existingEnt: Ent | undefined = undefined,
  ) {
    this.viewer = new LoggedOutViewer();
    this.ops.push(new dataOp(this.fields, this.operation));
  }

  addEdge(options: edgeOpOptions): FakeBuilder {
    this.ops.push(new edgeOp(options));
    return this;
  }

  async build(): Promise<Changeset<User>> {
    return new EntChangeset(
      this.viewer,
      this.placeholderID,
      this.ent,
      this.ops,
    );
  }
}

class dataOp implements DataOperation<User> {
  private id: ID | null;
  constructor(
    private fields: Map<string, any>,
    private operation: WriteOperation,
  ) {
    if (this.operation === WriteOperation.Insert) {
      this.id = newID();
    }
  }

  async performWrite(queryer: Queryer): Promise<void> {
    let keys: string[] = [];
    let values: any[] = [];
    for (const [key, value] of this.fields) {
      keys.push(key);
      values.push(value);
    }
    if (this.operation === WriteOperation.Insert) {
      keys.push("id");
      values.push(this.id);
    }
    queryer.query(`${this.operation} ${keys.join(", ")}`, values);
  }

  returnedEntRow?(viewer: LoggedOutViewer): User | null {
    if (this.operation === WriteOperation.Insert) {
      let ent = {};
      for (const [key, value] of this.fields) {
        ent[key] = value;
      }
      ent["id"] = this.id;
      return new User(viewer, this.id!, ent);
    }
    return null;
  }
}

interface edgeOpOptions {
  id1: ID;
  id2: ID;
  id1Placeholder?: boolean;
  id2Placeholder?: boolean;
}
class edgeOp implements DataOperation<never> {
  constructor(private options: edgeOpOptions) {}

  async performWrite(queryer: Queryer): Promise<void> {
    queryer.query("edge", [this.options.id1, this.options.id2]);
  }

  resolve(executor: Executor): void {
    if (this.options.id1Placeholder) {
      let id1 = executor.resolveValue(this.options.id1);
      if (!id1) {
        throw new Error(
          `could not resolve id1 placeholder ${this.options.id1}`,
        );
      }
      this.options.id1 = id1;
    }
    if (this.options.id2Placeholder) {
      let id2 = executor.resolveValue(this.options.id2);
      if (!id2) {
        throw new Error(
          `could not resolve id2 placeholder ${this.options.id2}`,
        );
      }
      this.options.id2 = id2;
    }
  }
}

test("simple", async () => {
  const builder = new FakeBuilder(
    new Map([["foo", "bar"]]),
    WriteOperation.Insert,
  );

  let ent = await saveBuilder(builder);
  //  console.log(ent);
  validateQueryOrder(
    [
      {
        query: "BEGIN",
      },
      {
        query: "insert foo, id",
        values: ["bar", "{id}"],
      },
      {
        query: "COMMIT",
      },
    ],
    ent,
  );
});

test("new ent with edge", async () => {
  const builder = new FakeBuilder(
    new Map([["foo", "bar"]]),
    WriteOperation.Insert,
  );
  const id2 = newID();
  builder.addEdge({
    id1: builder.placeholderID,
    id2: id2,
    id1Placeholder: true,
  });

  let ent = await saveBuilder(builder);
  validateQueryOrder(
    [
      {
        query: "BEGIN",
      },
      {
        query: "insert foo, id",
        values: ["bar", "{id}"],
      },
      {
        query: "edge",
        values: ["{id}", id2],
      },
      {
        query: "COMMIT",
      },
    ],
    ent,
  );
});

test("existing ent with edge", async () => {
  const user = new User(new LoggedOutViewer(), newID(), {});
  const builder = new FakeBuilder(
    new Map([["foo", "bar"]]),
    WriteOperation.Edit,
    user,
  );
  const id2 = newID();
  builder.addEdge({
    id1: user.id,
    id2: id2,
  });

  let ent = await saveBuilder(builder);
  validateQueryOrder(
    [
      {
        query: "BEGIN",
      },
      {
        query: "edit foo",
        values: ["bar"],
      },
      {
        query: "edge",
        values: [user.id, id2],
      },
      {
        query: "COMMIT",
      },
    ],
    ent,
  );
});

test("insert with incorrect resolver", async () => {
  const builder = new FakeBuilder(
    new Map([["foo", "bar"]]),
    WriteOperation.Insert,
  );
  const id2 = newID();
  builder.addEdge({
    id1: "2",
    id2: id2,
    id1Placeholder: true,
  });

  let ent: User | null = null;
  try {
    ent = await saveBuilderX(builder);
    fail("should have thrown exception");
  } catch (error) {
    expect(error.message).toBe("could not resolve id1 placeholder 2");
  }
  validateQueryOrder(
    [
      {
        query: "BEGIN",
      },
      {
        query: "insert foo, id",
        // first id created. can't use ent.id here since we don't get ent back...
        values: ["bar", ids[0]],
      },
      {
        query: "ROLLBACK",
      },
    ],
    ent,
  );
});

interface queryOptions {
  query: string;
  values?: any[];
}

function validateQueryOrder(expected: queryOptions[], ent: User | null) {
  expect(queries.length).toBe(expected.length);

  for (let i = 0; i < expected.length; i++) {
    expect(queries[i].query, `${i}th query`).toBe(expected[i].query);

    if (expected[i].values === undefined) {
      expect(queries[i].values, `${i}th query`).toBe(undefined);
    } else {
      let expectedVals = expected[i].values!;
      let actualVals = queries[i].values!;
      expect(actualVals.length, `${i}th query`).toBe(expectedVals.length);

      for (let j = 0; j < expectedVals.length; j++) {
        let expectedVal = expectedVals[j];
        let actualVal = actualVals[j];

        if (expectedVal === "{id}") {
          expectedVal = ent?.id;
        }
        expect(actualVal, `${i}th query`).toBe(expectedVal);
      }
    }
  }
}
