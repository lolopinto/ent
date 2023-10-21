import { Account, AccountToTodosQuery, Todo } from "src/ent";
import {
  expectMutation,
  expectQueryFromRoot,
} from "@snowtop/ent-graphql-tests";
import schema from "src/graphql/generated/schema";
import { ChangeTodoStatusAction } from "src/ent/todo/actions/change_todo_status_action";
import {
  createAccount,
  createTodoForSelf,
  createTag,
  createWorkspace,
  createTodoOtherInWorksapce,
} from "src/ent/testutils/util";
import { advanceBy } from "jest-date-mock";
import { DeleteTodoAction } from "src/ent/todo/actions/delete_todo_action";

async function createTodos(): Promise<[Account, Todo[]]> {
  const account = await createAccount();
  const texts = ["watch GOT", "take dog out", "take out trash", "call mom"];

  const todos: Todo[] = [];
  for (const text of texts) {
    // make deterministic
    advanceBy(-10);
    const todo = await createTodoForSelf({
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
    ["todos.rawCount", 3],
  );
});

test("open todos plural from account", async () => {
  const [account, todos] = await createTodos();
  expect(todos.length).toBe(4);

  // complete the first
  await ChangeTodoStatusAction.create(account.viewer, todos[0], {
    completed: true,
  }).saveX();

  // soft delete the 2nd
  await DeleteTodoAction.create(account.viewer, todos[1]).saveX();

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
      todos.slice(2).map((todo) => {
        return {
          text: todo.text,
        };
      }),
    ],
  );
});

test("open todos connection from account", async () => {
  const [account, todos] = await createTodos();
  expect(todos.length).toBe(4);

  // complete the first
  await ChangeTodoStatusAction.create(account.viewer, todos[0], {
    completed: true,
  }).saveX();

  // soft delete the 2nd
  await DeleteTodoAction.create(account.viewer, todos[1]).saveX();

  await expectQueryFromRoot(
    {
      viewer: account.viewer,
      schema: schema,
      root: "account",
      args: {
        id: account.id,
      },
    },
    ["open_todos.rawCount", 2],
    [
      "open_todos.nodes",
      todos.slice(2).map((todo) => {
        return {
          text: todo.text,
        };
      }),
    ],
  );
});

test("open todos plural from root", async () => {
  const [account, todos] = await createTodos();
  expect(todos.length).toBe(4);

  // complete the first
  await ChangeTodoStatusAction.create(account.viewer, todos[0], {
    completed: true,
  }).saveX();

  // soft delete the 2nd
  await DeleteTodoAction.create(account.viewer, todos[1]).saveX();

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
      todos.slice(2).map((todo) => {
        return {
          text: todo.text,
        };
      }),
    ],
  );
});

test("open todos connection from root", async () => {
  const [account, todos] = await createTodos();
  expect(todos.length).toBe(4);

  // complete the first
  await ChangeTodoStatusAction.create(account.viewer, todos[0], {
    completed: true,
  }).saveX();

  // soft delete the 2nd
  await DeleteTodoAction.create(account.viewer, todos[1]).saveX();

  // open todos returns non-deleted, non-complete things
  await expectQueryFromRoot(
    {
      viewer: account.viewer,
      schema: schema,
      root: "open_todos",
      args: {
        id: account.id,
      },
    },
    ["rawCount", 2],
    [
      "nodes",
      todos.slice(2).map((todo) => {
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
      args: {
        creator_id: account.id,
        text: "watch GOT",
        assignee_id: account.id,
        scope_id: account.id,
        scope_type: "account",
      },
    },
    [
      "todo.id",
      async (id: string) => {
        await Todo.loadX(account.viewer, id);
      },
    ],
    ["todo.text", "watch GOT"],
    ["todo.creator.id", account.id],
    ["todo.assignee.id", account.id],
    ["todo.scope.id", account.id],
  );
});

test("create in workspace", async () => {
  const account = await createAccount();
  const workspace = await createWorkspace(account);
  await expectMutation(
    {
      viewer: account.viewer,
      schema: schema,
      mutation: "createTodo",
      args: {
        creator_id: account.id,
        text: "watch GOT",
        assignee_id: account.id,
        scope_id: workspace.id,
        scope_type: "workspace",
      },
    },
    [
      "todo.id",
      async (id: string) => {
        await Todo.loadX(account.viewer, id);
      },
    ],
    ["todo.text", "watch GOT"],
    ["todo.creator.id", account.id],
    ["todo.assignee.id", account.id],
    ["todo.scope.id", workspace.id],
  );
});

test("edit", async () => {
  const account = await createAccount();
  const todo = await createTodoForSelf({
    creatorID: account.id,
    text: "watch GOT",
  });
  await expectMutation(
    {
      viewer: account.viewer,
      schema: schema,
      mutation: "renameTodo",
      args: {
        id: todo.id,
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
  const todo = await createTodoForSelf({
    creatorID: account.id,
    text: "watch GOT",
  });
  await expectMutation(
    {
      viewer: account.viewer,
      schema: schema,
      mutation: "deleteTodo",
      args: { id: todo.id },
    },
    ["deleted_todo_id", todo.id],
  );
});

test("todo tag", async () => {
  const account = await createAccount();
  const tag = await createTag("sports", account);
  const todo = await createTodoForSelf({
    creatorID: account.id,
  });

  await expectMutation(
    {
      viewer: account.viewer,
      schema,
      mutation: "addTodoTag",
      args: {
        id: todo.id,
        tag_id: tag.id,
      },
    },
    ["todo.tags.rawCount", 1],
    ["todo.tags.nodes[0].id", tag.id],
  );
});

test("assignees", async () => {
  const { todo } = await createTodoOtherInWorksapce();
  const todo2 = await createTodoForSelf({
    creatorID: todo.assigneeID,
  });
  const todo3 = await createTodoForSelf({
    creatorID: todo.assigneeID,
  });

  const account = await todo.loadAssigneeX();

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
      "todos_assigned(first:100) { edges { node { id } } } ",
      function (data: any) {
        expect(data.edges.length).toBe(3);
        const ids = data.edges.map((edge: any) => edge.node.id);
        expect(ids.sort()).toStrictEqual([todo.id, todo2.id, todo3.id].sort());
      },
    ],
  );
});
