import { WriteOperation } from "./action";
import { User, FakeBuilder } from "./testutils/builder";
import { LoggedOutViewer } from "./viewer";
import { Pool } from "pg";
import { QueryRecorder } from "./testutils/db_mock";

jest.mock("pg");
QueryRecorder.mockPool(Pool);

afterEach(() => {
  QueryRecorder.clear();
});

test("simple", async () => {
  const builder = new FakeBuilder(
    new Map([["foo", "bar"]]),
    WriteOperation.Insert,
  );

  let ent = await builder.save();
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
  QueryRecorder.validateQueriesInTx(
    [
      {
        query: "insert foo, id",
        values: ["bar", "{id}"],
      },
      {
        query: "edge",
        values: ["{id}", id2],
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
  QueryRecorder.validateQueriesInTx(
    [
      {
        query: "edit foo",
        values: ["bar"],
      },
      {
        query: "edge",
        values: [user.id, id2],
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
  QueryRecorder.validateFailedQueriesInTx(
    [
      {
        query: "insert foo, id",
        // first id created. can't use ent.id here since we don't get ent back...
        values: ["bar", QueryRecorder.getCurrentIDs()[0]],
      },
    ],
    ent,
  );
});
