import ChangeTodoStatusAction from "src/ent/todo/actions/change_todo_status_action";
import RenameTodoStatusAction from "src/ent/todo/actions/rename_todo_status_action";
import DeleteTodoAction from "src/ent/todo/actions/delete_todo_action";
import { Todo, EdgeType } from "src/ent/";
import { createAccount, createTag, createTodo } from "../testutils/util";
import { query } from "@snowtop/ent";
import { advanceTo } from "jest-date-mock";
import TodoAddTagAction from "../todo/actions/todo_add_tag_action";
import TodoRemoveTagAction from "../todo/actions/todo_remove_tag_action";
import { loadCustomEdges } from "@snowtop/ent/core/ent";
import { CustomTodoEdge } from "../edge/custom_edge";

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
  expect(todo.getDeletedAt()).toBeNull();

  const d = new Date();
  advanceTo(d);
  await DeleteTodoAction.create(todo.viewer, todo).saveX();

  const reloaded = await Todo.load(todo.viewer, todo.id);
  expect(reloaded).toBeNull();

  const transformed = await Todo.loadNoTransform(todo.viewer, todo.id);
  expect(transformed).not.toBeNull();
  expect(transformed?.getDeletedAt()).toEqual(d);

  // then really delete
  await DeleteTodoAction.create(todo.viewer, todo).saveWithoutTransformX();
  const transformed2 = await Todo.loadNoTransform(todo.viewer, todo.id);
  expect(transformed2).toBeNull();
});

test("really delete", async () => {
  let todo = await createTodo();
  expect(todo.getDeletedAt()).toBeNull();

  const d = new Date();
  advanceTo(d);
  await DeleteTodoAction.create(todo.viewer, todo).saveWithoutTransformX();

  const reloaded = await Todo.load(todo.viewer, todo.id);
  expect(reloaded).toBeNull();

  const transformed = await Todo.loadNoTransform(todo.viewer, todo.id);
  expect(transformed).toBeNull();
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

  const openTodosCount = await Todo.loadCustomCount(
    query.And(query.Eq("creator_id", account.id), query.Eq("completed", false)),
  );
  expect(openTodosCount).toBe(3);

  const closedTodos = await Todo.loadCustom(
    account.viewer,
    query.And(query.Eq("creator_id", account.id), query.Eq("completed", true)),
  );
  expect(closedTodos.length).toBe(2);

  const closedTodosCount = await Todo.loadCustomCount(
    query.And(query.Eq("creator_id", account.id), query.Eq("completed", true)),
  );
  expect(closedTodosCount).toBe(2);

  const orderedOpenedTodos = await Todo.loadCustom(account.viewer, {
    clause: query.And(
      query.Eq("creator_id", account.id),
      query.Eq("completed", false),
    ),
    orderby: "created_at desc",
  });
  expect(orderedOpenedTodos.length).toBe(3);
});

test("tags", async () => {
  const todo = await createTodo();
  const account = await todo.loadCreatorX();
  const tag = await createTag("sports", account);
  const tag2 = await createTag("hello", account);
  const tag3 = await createTag("exercise", account);
  const tag4 = await createTag("fun", account);

  await TodoAddTagAction.create(todo.viewer, todo)
    .addTag(tag)
    .addTag(tag2)
    .addTag(tag3)
    .addTag(tag4)
    .saveX();

  const count = await todo.queryTags().queryRawCount();
  const tags = await todo.queryTags().queryEnts();
  const edges = await todo.queryTags().queryEdges();

  expect(count).toBe(4);
  expect(tags.length).toBe(4);
  expect(edges.length).toBe(4);
  expect(edges.every((edge) => edge.deletedAt === null)).toBe(true);

  await TodoRemoveTagAction.create(todo.viewer, todo).removeTag(tag).saveX();

  const count2 = await todo.queryTags().queryRawCount();
  const tags2 = await todo.queryTags().queryEnts();
  const edges2 = await todo.queryTags().queryEdges();

  expect(edges2.length).toBe(3);
  expect(edges2.every((edge) => edge.deletedAt === null)).toBe(true);
  expect(count2).toBe(3);
  expect(tags2.length).toBe(3);

  // the deleted one is still in the db, just not returned by queries
  const rawDB = await loadCustomEdges({
    edgeType: EdgeType.TodoToTags,
    id1: todo.id,
    ctr: CustomTodoEdge,
    disableTransformations: true,
  });
  expect(rawDB.length).toBe(4);
  expect(rawDB.filter((edge) => edge.deletedAt !== null).length).toBe(1);
});
