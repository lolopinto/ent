import { Account, Todo } from "src/ent";
import { expectQueryFromRoot } from "@snowtop/ent-graphql-tests";
import schema from "src/graphql/generated/schema";
import ChangeTodoStatusAction from "src/ent/todo/actions/change_todo_status_action";
import { createAccount, createTodo } from "src/ent/testutils/util";
import { advanceBy } from "jest-date-mock";
import { DB, loadConfig } from "@snowtop/ent";
import * as fs from "fs";

beforeAll(() => {
  const f = fs.readFileSync("src/schema/schema.sql");
  process.env.DB_CONNECTION_STRING = `sqlite:///`;

  // everything in memory for this test
  loadConfig({
    // log: "query",
  });

  const sqlite = DB.getInstance().getSQLiteClient();

  // @ts-ignore
  sqlite.db.exec(f.toString());
});

async function createTodos(): Promise<[Account, Todo[]]> {
  const account = await createAccount();
  const texts = ["watch GOT", "take dog out", "take out trash", "call mom"];

  const todos: Todo[] = [];
  for (const text of texts) {
    // make deterministic
    advanceBy(-10);
    const todo = await createTodo({
      creatorID: account.id,
      text: text,
    });
    todos.push(todo);
  }

  return [account, todos];
}

test("closed todos last day", async () => {
  const [account1, todos] = await createTodos();
  expect(todos.length).toBe(4);

  const [account2, todos2] = await createTodos();
  expect(todos2.length).toBe(4);

  const [account3, todos3] = await createTodos();
  expect(todos3.length).toBe(4);

  // these 2 will get excluded
  await ChangeTodoStatusAction.create(account1.viewer, todos[0], {
    completed: true,
  }).saveX();
  await ChangeTodoStatusAction.create(account1.viewer, todos[1], {
    completed: true,
  }).saveX();

  // 1 day in the future
  advanceBy(1 * 86400 * 1000);

  await ChangeTodoStatusAction.create(account2.viewer, todos2[0], {
    completed: true,
  }).saveX();

  // 2 hours
  advanceBy(2 * 60 * 60 * 1000);

  await ChangeTodoStatusAction.create(account3.viewer, todos3[0], {
    completed: true,
  }).saveX();

  // 2 hours
  advanceBy(2 * 60 * 60 * 1000);

  await ChangeTodoStatusAction.create(account3.viewer, todos3[1], {
    completed: true,
  }).saveX();

  await expectQueryFromRoot(
    {
      viewer: account1.viewer,
      schema: schema,
      root: "closed_todos_last_day",
      args: {
        id: account1.id,
      },
    },
    ["rawCount", 3],
  );

  let lastCursor = "";
  await expectQueryFromRoot(
    {
      viewer: account1.viewer,
      schema: schema,
      root: "closed_todos_last_day",
      args: {
        id: account1.id,
        first: 2,
      },
    },
    ["rawCount", 3],
    ["pageInfo.hasNextPage", true],
    [
      "pageInfo.endCursor",
      (v: string) => {
        lastCursor = v;
      },
    ],
  );

  await expectQueryFromRoot(
    {
      viewer: account1.viewer,
      schema: schema,
      root: "closed_todos_last_day",
      args: {
        id: account1.id,
        first: 2,
        after: lastCursor,
      },
    },
    ["rawCount", 3],
    ["pageInfo.hasNextPage", false],
  );
});
