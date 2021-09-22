import ChangeTodoStatusAction from "src/ent/todo/actions/change_todo_status_action";
import RenameTodoStatusAction from "src/ent/todo/actions/rename_todo_status_action";
import DeleteTodoAction from "src/ent/todo/actions/delete_todo_action";
import { Todo } from "src/ent/internal";
import { createAccount, createTodo } from "../testutils/util";
import { query } from "@snowtop/ent";

beforeAll(() => {
  process.env.DB_CONNECTION_STRING = `sqlite:///todo.db`;
});

test("create", async () => {
  await createTodo();
});

async function changeCompleted(todo: Todo, completed: boolean) {
  todo = await ChangeTodoStatusAction.create(todo.viewer, todo, {
    completed: completed,
  }).saveX();

  expect(todo.completed).toBe(completed);
  return todo;
}

test("mark as completed", async () => {
  let todo = await createTodo();

  todo = await changeCompleted(todo, true);

  // reopen
  todo = await changeCompleted(todo, false);
});

test("rename todo", async () => {
  let todo = await createTodo();

  todo = await RenameTodoStatusAction.create(todo.viewer, todo, {
    text: "re-watch GOT",
  }).saveX();

  expect(todo.text).toBe("re-watch GOT");
});

test("delete todo", async () => {
  let todo = await createTodo();

  await DeleteTodoAction.create(todo.viewer, todo).saveX();

  const reloaded = await Todo.load(todo.viewer, todo.id);
  expect(reloaded).toBeNull();
});

test("querying todos", async () => {
  const account = await createAccount();
  const todos = await Promise.all(
    [1, 2, 3, 4, 5].map(() => createTodo({ creatorID: account.id })),
  );
  expect(todos.length).toBe(5);

  await changeCompleted(todos[0], true);

  await changeCompleted(todos[4], true);

  const openTodos = await Todo.loadCustom(
    account.viewer,
    query.And(query.Eq("creator_id", account.id), query.Eq("completed", false)),
  );
  expect(openTodos.length).toBe(3);

  const closedTodos = await Todo.loadCustom(
    account.viewer,
    query.And(query.Eq("creator_id", account.id), query.Eq("completed", true)),
  );
  expect(closedTodos.length).toBe(2);

  const orderedOpenedTodos = await Todo.loadCustom(account.viewer, {
    clause: query.And(
      query.Eq("creator_id", account.id),
      query.Eq("completed", false),
    ),
    orderby: "created_at desc",
  });
  expect(orderedOpenedTodos.length).toBe(3);
});
