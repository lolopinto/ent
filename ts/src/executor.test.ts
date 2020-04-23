import { Ent, DataOperation } from "./ent";
import { Builder, Executor, WriteOperation } from "./action";
import * as action from "./action";
import * as ent from "./ent";

import DB from "./db";

import { Pool } from "pg";
import { QueryRecorder } from "./testutils/db_mock";
import {
  User,
  FakeBuilder,
  Contact,
  SimpleBuilder,
  SimpleAction,
} from "./testutils/builder";
import { LoggedOutViewer } from "./viewer";
import { BaseEntSchema, Field } from "./schema";
import { StringType, TimeType } from "./field";

jest.mock("pg");
QueryRecorder.mockPool(Pool);
QueryRecorder.mockLoadEdgeDatas(ent);

let operations: DataOperation[] = [];

afterEach(() => {
  QueryRecorder.clear();
  operations = [];
});

jest.spyOn(action, "saveBuilder").mockImplementation(saveBuilder);

async function saveBuilder<T extends Ent>(builder: Builder<T>): Promise<void> {
  const changeset = await builder.build();
  const executor = changeset.executor();
  await executeOperations(executor);
}

async function executeOperations<T extends Ent>(
  executor: Executor<T>,
): Promise<void> {
  const client = await DB.getInstance().getNewClient();

  try {
    await client.query("BEGIN");
    for (const operation of executor) {
      // resolve any placeholders before writes
      operations.push(operation);
      if (operation.resolve) {
        operation.resolve(executor);
      }

      await operation.performWrite(client);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
  }
}

async function executor<T extends Ent>(
  builder: Builder<T>,
): Promise<Executor<T>> {
  const changeset = await builder.build();
  return changeset.executor();
}

class UserSchema extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
  ];
  ent = User;
}

class ContactSchema extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
    StringType({ name: "UserID" }),
  ];
  ent = Contact;
}

test("empty", async () => {
  const builder = new FakeBuilder(new Map(), WriteOperation.Insert, User);

  let ent = await builder.save();
  expect(ent).toBe(null);
  expect(operations.length).toBe(0);
});

test("simple-one-op-created-ent", async () => {
  const builder = new FakeBuilder(
    new Map([["foo", "bar"]]),
    WriteOperation.Insert,
    User,
  );

  const exec = await executor(builder);
  await executeOperations(exec);
  let ent = builder.createdEnt();
  expect(ent).not.toBe(null);
  expect(exec.resolveValue(builder.placeholderID)).toStrictEqual(ent);
  expect(exec.resolveValue(ent?.id)).toBe(null);

  expect(operations.length).toBe(1);
  QueryRecorder.validateQueriesInTx(
    [
      {
        query: "insert foo, id",
        values: ["bar", "{id}"],
      },
    ],
    ent,
  );
});

test("simple-one-op-no-created-ent", async () => {
  const user = new User(new LoggedOutViewer(), QueryRecorder.newID(), {});
  const builder = new FakeBuilder(new Map(), WriteOperation.Edit, User, user);

  const id2 = QueryRecorder.newID();
  builder.addEdge({ id1: user.id, id2: id2 });

  const exec = await executor(builder);
  await executeOperations(exec);
  let ent = builder.createdEnt();
  expect(ent).toBe(null);
  expect(exec.resolveValue(builder.placeholderID)).toBe(null);

  expect(operations.length).toBe(1);
  QueryRecorder.validateQueriesInTx(
    [
      {
        query: "edge",
        values: [user.id, id2],
      },
    ],
    ent,
  );
});

test.only("list-based-with-dependency", async () => {
  let userBuilder = new SimpleBuilder(
    new LoggedOutViewer(),
    new UserSchema(),
    new Map([
      ["FirstName", "Jon"],
      ["LastName", "Snow"],
    ]),
    WriteOperation.Insert,
  );
  let firstName = userBuilder.fields.get("FirstName");
  let lastName = userBuilder.fields.get("LastName");
  let contactAction = new SimpleAction(
    userBuilder.viewer,
    new ContactSchema(),
    new Map([
      ["FirstName", firstName],
      ["LastName", lastName],
      ["UserID", userBuilder],
    ]),
    WriteOperation.Insert,
  );
});

test("complex-based-with-dependencies", async () => {
  // todo this is complex with dependencies
  let contactAction: SimpleAction<Contact>;
  const action = new SimpleAction(
    new LoggedOutViewer(),
    new UserSchema(),
    new Map([
      ["FirstName", "Jon"],
      ["LastName", "Snow"],
    ]),
    WriteOperation.Insert,
  );
  action.triggers = [
    {
      changeset: (
        builder: SimpleBuilder<User>,
      ): Promise<action.Changeset<Contact>> => {
        let firstName = builder.fields.get("FirstName");
        let lastName = builder.fields.get("LastName");
        contactAction = new SimpleAction(
          builder.viewer,
          new ContactSchema(),
          new Map([
            ["FirstName", firstName],
            ["LastName", lastName],
            ["UserID", builder],
          ]),
          WriteOperation.Insert,
        );
        builder.orchestrator.addOutboundEdge(
          contactAction.builder,
          "fakeEdge",
          "contact",
        );
        return contactAction.changeset();
      },
    },
  ];
  const exec = await executor(action.builder);
  console.log(exec);
  // await executeOperations(exec);
  // let ent = builder.createdEnt();
  // expect(ent).toBe(null);
  // expect(exec.resolveValue(builder.placeholderID)).toBe(null);
  // expect(operations.length).toBe(1);
  // QueryRecorder.validateQueriesInTx(
  //   [
  //     {
  //       query: "edge",
  //       values: [user.id, id2],
  //     },
  //   ],
  //   ent,
  // );
});
