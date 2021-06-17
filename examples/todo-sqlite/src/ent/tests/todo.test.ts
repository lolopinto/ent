import ChangeTodoStatusAction from "src/ent/todo/actions/change_todo_status_action";
import RenameTodoStatusAction from "src/ent/todo/actions/rename_todo_status_action";
import DeleteTodoAction from "src/ent/todo/actions/delete_todo_action";
import { Todo } from "src/ent/";
import { createTodo } from "../testutils/util";
beforeAll(() => {
  process.env.DB_CONNECTION_STRING = `sqlite:///todo.db`;
});

test("create", async () => {
  await createTodo();
});

test("mark as completed", async () => {
  let todo = await createTodo();

  todo = await ChangeTodoStatusAction.create(todo.viewer, todo, {
    completed: true,
  }).saveX();

  expect(todo.completed).toBe(true);

  // reopen
  todo = await ChangeTodoStatusAction.create(todo.viewer, todo, {
    completed: false,
  }).saveX();

  expect(todo.completed).toBe(false);
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
