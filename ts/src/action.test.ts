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
import { EntChangeset } from "./orchestrator";
import { LoggedOutViewer } from "./viewer";
import { Pool } from "pg";
import { QueryRecorder } from "./testutils/db_mock";

jest.mock("pg");
QueryRecorder.mockPool(Pool);

afterEach(() => {
  QueryRecorder.clear();
});

class FakeBuilder implements Builder<User> {
  ent = User;
  placeholderID = "1";
  viewer: Viewer;

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

  private createdUser(): User | null {
    let dataOp = this.ops[0];
    if (!dataOp || !dataOp.returnedEntRow) {
      return null;
    }
    let row = dataOp.returnedEntRow();
    if (!row) {
      return null;
    }
    return new User(this.viewer, row["id"], row);
  }

  async save(): Promise<User | null> {
    await saveBuilder(this);
    return this.createdUser();
  }

  async saveX(): Promise<User> {
    await saveBuilderX(this);
    return this.createdUser()!;
  }
}

class dataOp implements DataOperation<User> {
  private id: ID | null;
  constructor(
    private fields: Map<string, any>,
    private operation: WriteOperation,
  ) {
    if (this.operation === WriteOperation.Insert) {
      this.id = QueryRecorder.newID();
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

  returnedEntRow?(): {} | null {
    if (this.operation === WriteOperation.Insert) {
      let row = {};
      for (const [key, value] of this.fields) {
        row[key] = value;
      }
      row["id"] = this.id;
      return row;
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

  resolve<T extends Ent>(executor: Executor<T>): void {
    if (this.options.id1Placeholder) {
      let ent = executor.resolveValue(this.options.id1);
      if (!ent) {
        throw new Error(
          `could not resolve id1 placeholder ${this.options.id1}`,
        );
      }
      this.options.id1 = ent.id;
    }
    if (this.options.id2Placeholder) {
      let ent = executor.resolveValue(this.options.id2);
      if (!ent) {
        throw new Error(
          `could not resolve id2 placeholder ${this.options.id2}`,
        );
      }
      this.options.id2 = ent.id;
    }
  }
}

test("simple", async () => {
  const builder = new FakeBuilder(
    new Map([["foo", "bar"]]),
    WriteOperation.Insert,
  );

  let ent = await builder.save();
  QueryRecorder.validateQueryOrder(
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
  const id2 = QueryRecorder.newID();
  builder.addEdge({
    id1: builder.placeholderID,
    id2: id2,
    id1Placeholder: true,
  });

  let ent = await builder.save();
  QueryRecorder.validateQueryOrder(
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
  const user = new User(new LoggedOutViewer(), QueryRecorder.newID(), {});
  const builder = new FakeBuilder(
    new Map([["foo", "bar"]]),
    WriteOperation.Edit,
    user,
  );
  const id2 = QueryRecorder.newID();
  builder.addEdge({
    id1: user.id,
    id2: id2,
  });

  let ent = await builder.save();
  QueryRecorder.validateQueryOrder(
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
  const id2 = QueryRecorder.newID();
  builder.addEdge({
    id1: "2",
    id2: id2,
    id1Placeholder: true,
  });

  let ent: User | null = null;
  try {
    ent = await builder.saveX();
    fail("should have thrown exception");
  } catch (error) {
    expect(error.message).toBe("could not resolve id1 placeholder 2");
  }
  QueryRecorder.validateQueryOrder(
    [
      {
        query: "BEGIN",
      },
      {
        query: "insert foo, id",
        // first id created. can't use ent.id here since we don't get ent back...
        values: ["bar", QueryRecorder.getCurrentIDs()[0]],
      },
      {
        query: "ROLLBACK",
      },
    ],
    ent,
  );
});
