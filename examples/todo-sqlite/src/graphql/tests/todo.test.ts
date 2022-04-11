import { Account, AccountToTodosQuery, Todo } from "src/ent";
import {
  expectMutation,
  expectQueryFromRoot,
} from "@snowtop/ent-graphql-tests";
import schema from "src/graphql/generated/schema";
import ChangeTodoStatusAction from "src/ent/todo/actions/change_todo_status_action";
import { createAccount, createTodo, createTag } from "src/ent/testutils/util";
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
      mutation: "markAllTodosAs",
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
      mutation: "markAllTodosAs",
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
      mutation: "removeCompletedTodos",
      args: { accountID: account.id },
      disableInputWrapping: true,
    },
    ["id", account.id],
    // now 3 because deleted now
    // TODO should be 3. still 4 because we don't account for foreign keys with soft deletes
    //    ["todos.rawCount", 3],
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
      "open_todos_plural",
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
    ["open_todos.rawCount", todos.length - 1],
    [
      "open_todos.nodes",
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
      root: "open_todos_plural",
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
      root: "open_todos",
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

test("create", async () => {
  const account = await createAccount();
  await expectMutation(
    {
      viewer: account.viewer,
      schema: schema,
      mutation: "createTodo",
      args: { creator_id: account.id, text: "watch GOT" },
    },
    [
      "todo.id",
      async (id: string) => {
        await Todo.loadX(account.viewer, id);
      },
    ],
    ["todo.text", "watch GOT"],
    ["todo.creator.id", account.id],
  );
});

test("edit", async () => {
  const account = await createAccount();
  const todo = await createTodo({
    creatorID: account.id,
    text: "watch GOT",
  });
  await expectMutation(
    {
      viewer: account.viewer,
      schema: schema,
      mutation: "renameTodo",
      args: {
        todo_id: todo.id,
        text: "watch GOT tomorrow",
        reason_for_change: "time for fun",
      },
    },
    ["todo.id", todo.id],
    ["todo.text", "watch GOT tomorrow"],
    ["todo.creator.id", account.id],
  );
});

test("delete", async () => {
  const account = await createAccount();
  const todo = await createTodo({
    creatorID: account.id,
    text: "watch GOT",
  });
  await expectMutation(
    {
      viewer: account.viewer,
      schema: schema,
      mutation: "deleteTodo",
      args: { todo_id: todo.id },
    },
    ["deleted_todo_id", todo.id],
  );
});

test("todo tag", async () => {
  const account = await createAccount();
  const tag = await createTag("sports", account);
  const todo = await createTodo({
    creatorID: account.id,
  });

  await expectMutation(
    {
      viewer: account.viewer,
      schema,
      mutation: "addTodoTag",
      args: {
        todo_id: todo.id,
        tag_id: tag.id,
      },
    },
    ["todo.tags.rawCount", 1],
    ["todo.tags.nodes[0].id", tag.id],
  );
});
