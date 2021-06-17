import { AccountToTodosQuery } from "src/ent";
import { expectMutation } from "@lolopinto/ent-graphql-tests";
import schema from "src/graphql/schema";
import { encodeGQLID } from "@lolopinto/ent/graphql";
import ChangeTodoStatusAction from "src/ent/todo/actions/change_todo_status_action";
import { createAccount, createTodo } from "src/ent/testutils/util";

beforeAll(() => {
  process.env.DB_CONNECTION_STRING = `sqlite:///todo.db`;
});

test("mark all as completed", async () => {
  const account = await createAccount();
  await Promise.all([
    createTodo({
      creatorID: account.id,
      text: "watch GOT",
    }),
    createTodo({
      creatorID: account.id,
      text: "take dog out",
    }),
    createTodo({
      creatorID: account.id,
      text: "take out trash",
    }),
    createTodo({
      creatorID: account.id,
      text: "call mom",
    }),
  ]);

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
      args: { accountID: encodeGQLID(account), completed: true },
      disableInputWrapping: true,
    },
    ["id", encodeGQLID(account)],
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
      args: { accountID: encodeGQLID(account), completed: false },
      disableInputWrapping: true,
    },
    ["id", encodeGQLID(account)],
  );

  const loadedTodos3 = await AccountToTodosQuery.query(
    account.viewer,
    account,
  ).queryEnts();

  expect(loadedTodos3.every((todo) => !todo.completed)).toBe(true);
});

test("remove completed", async () => {
  const account = await createAccount();
  const todos = await Promise.all([
    createTodo({
      creatorID: account.id,
      text: "watch GOT",
    }),
    createTodo({
      creatorID: account.id,
      text: "take dog out",
    }),
    createTodo({
      creatorID: account.id,
      text: "take out trash",
    }),
    createTodo({
      creatorID: account.id,
      text: "call mom",
    }),
  ]);

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
      args: { accountID: encodeGQLID(account) },
      disableInputWrapping: true,
    },
    ["id", encodeGQLID(account)],
    // now 3 because deleted now
    ["todos.rawCount", 3],
  );
});
