import { Account, AccountToTodosQuery, Todo } from "src/ent";
import {
  expectMutation,
  expectQueryFromRoot,
} from "@snowtop/ent-graphql-tests";
import schema from "src/graphql/generated/schema";
import ChangeTodoStatusAction from "src/ent/todo/actions/change_todo_status_action";
import { createAccount, createTodo } from "src/ent/testutils/util";
import { advanceBy } from "jest-date-mock";
beforeAll(() => {
  process.env.DB_CONNECTION_STRING = `sqlite:///todo.db`;
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

test("mark all as completed", async () => {
  const [account, todos] = await createTodos();
  const loadedTodos = await AccountToTodosQuery.query(
    account.viewer,
    account,
  ).queryEnts();
  expect(loadedTodos.every((todo) => !todo.completed)).toBe(true);

  await expectMutation(
    {
      viewer: account.viewer,
      schema: schema,
      mutation: "todosMarkAllAs",
      args: { accountID: account.id, completed: true },
      disableInputWrapping: true,
    },
    ["id", account.id],
  );

  const loadedTodos2 = await AccountToTodosQuery.query(
    account.viewer,
    account,
  ).queryEnts();

  expect(loadedTodos2.every((todo) => todo.completed)).toBe(true);

  await expectMutation(
    {
      viewer: account.viewer,
      schema: schema,
      mutation: "todosMarkAllAs",
      args: { accountID: account.id, completed: false },
      disableInputWrapping: true,
    },
    ["id", account.id],
  );

  const loadedTodos3 = await AccountToTodosQuery.query(
    account.viewer,
    account,
  ).queryEnts();

  expect(loadedTodos3.every((todo) => !todo.completed)).toBe(true);
});

test("remove completed", async () => {
  const [account, todos] = await createTodos();

  const count = await AccountToTodosQuery.query(
    account.viewer,
    account,
  ).queryCount();
  expect(count).toBe(4);

  // complete the first
  await ChangeTodoStatusAction.create(account.viewer, todos[0], {
    completed: true,
  }).saveX();

  await expectMutation(
    {
      viewer: account.viewer,
      schema: schema,
      mutation: "todosRemoveCompleted",
      args: { accountID: account.id },
      disableInputWrapping: true,
    },
    ["id", account.id],
    // now 3 because deleted now
    ["todos.rawCount", 3],
  );
});

test("open todos plural from account", async () => {
  const [account, todos] = await createTodos();

  // complete the first
  await ChangeTodoStatusAction.create(account.viewer, todos[0], {
    completed: true,
  }).saveX();

  await expectQueryFromRoot(
    {
      viewer: account.viewer,
      schema: schema,
      root: "account",
      args: {
        id: account.id,
      },
    },
    [
      "openTodosPlural",
      todos.slice(1).map((todo) => {
        return {
          text: todo.text,
        };
      }),
    ],
  );
});

test("open todos connection from account", async () => {
  const [account, todos] = await createTodos();

  // complete the first
  await ChangeTodoStatusAction.create(account.viewer, todos[0], {
    completed: true,
  }).saveX();

  await expectQueryFromRoot(
    {
      viewer: account.viewer,
      schema: schema,
      root: "account",
      args: {
        id: account.id,
      },
    },
    ["openTodos.rawCount", todos.length - 1],
    [
      "openTodos.nodes",
      todos.slice(1).map((todo) => {
        return {
          text: todo.text,
        };
      }),
    ],
  );
});

test("open todos plural from root", async () => {
  const [account, todos] = await createTodos();

  // complete the first
  await ChangeTodoStatusAction.create(account.viewer, todos[0], {
    completed: true,
  }).saveX();

  await expectQueryFromRoot(
    {
      viewer: account.viewer,
      schema: schema,
      root: "openTodosPlural",
      args: {
        id: account.id,
      },
    },
    [
      "",
      todos.slice(1).map((todo) => {
        return {
          text: todo.text,
        };
      }),
    ],
  );
});

test("open todos connection from root", async () => {
  const [account, todos] = await createTodos();

  // complete the first
  await ChangeTodoStatusAction.create(account.viewer, todos[0], {
    completed: true,
  }).saveX();

  await expectQueryFromRoot(
    {
      viewer: account.viewer,
      schema: schema,
      root: "openTodos",
      args: {
        id: account.id,
      },
    },
    ["rawCount", todos.length - 1],
    [
      "nodes",
      todos.slice(1).map((todo) => {
        return {
          text: todo.text,
        };
      }),
    ],
  );
});
