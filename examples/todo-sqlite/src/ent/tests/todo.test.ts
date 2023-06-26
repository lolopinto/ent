import ChangeTodoStatusAction from "src/ent/todo/actions/change_todo_status_action";
import RenameTodoStatusAction from "src/ent/todo/actions/rename_todo_status_action";
import DeleteTodoAction from "src/ent/todo/actions/delete_todo_action";
import { Account, Todo } from "src/ent/";
import { AccountTodoStatus, NodeType } from "src/ent/generated/types";
import {
  createAccount,
  createTag,
  createTodoForSelf,
  createTodoSelfInWorkspace,
  createTodoOtherInWorksapce,
} from "../testutils/util";
import { IDViewer, query } from "@snowtop/ent";
import { advanceTo } from "jest-date-mock";
import TodoAddTagAction from "../todo/actions/todo_add_tag_action";
import TodoRemoveTagAction from "../todo/actions/todo_remove_tag_action";
import CreateTodoAction from "../todo/actions/create_todo_action";
import ChangeTodoBountyAction from "../todo/actions/change_todo_bounty_action";
import { Transaction } from "@snowtop/ent/action";

test("create for self", async () => {
  await createTodoForSelf();
});

test("create for other", async () => {
  // in real life, you shouldn't just be able to create a TODO for anyone randomly lol
  const creator = await createAccount();
  const assignee = await createAccount();

  const todo = await CreateTodoAction.create(creator.viewer, {
    text: "watch GOT",
    creatorID: creator.id,
    assigneeID: assignee.id,
    scopeID: assignee.id,
    scopeType: NodeType.Account,
  }).saveX();
  expect(todo.text).toBe("watch GOT");
  expect(todo.creatorID).toBe(creator.id);
  expect(todo.completed).toBe(false);
  expect(todo.assigneeID).toBe(assignee.id);
  expect(todo.scopeID).toBe(assignee.id);
  expect(todo.scopeType).toBe(NodeType.Account);

  const scopedEnts = await todo.queryTodoScope().queryEnts();
  expect(scopedEnts.length).toBe(1);
  expect(scopedEnts[0].id).toBe(assignee.id);

  const todo2 = await CreateTodoAction.create(creator.viewer, {
    text: "watch GOT",
    creatorID: creator.id,
    assigneeID: assignee.id,
    scopeID: assignee.id,
    scopeType: NodeType.Account,
  }).saveX();
  expect(todo2.text).toBe("watch GOT");
  expect(todo2.creatorID).toBe(creator.id);
  expect(todo2.completed).toBe(false);
  expect(todo2.assigneeID).toBe(assignee.id);
  expect(todo2.scopeID).toBe(assignee.id);
  expect(todo2.scopeType).toBe(NodeType.Account);

  const scopedEnts2 = await todo2.queryTodoScope().queryEnts();
  expect(scopedEnts2.length).toBe(1);
  expect(scopedEnts2[0].id).toBe(assignee.id);

  const scopedTodos = await assignee.queryScopedTodos().queryEnts();
  expect(scopedTodos.length).toBe(2);
  expect(scopedTodos.map((t) => t.id).includes(todo.id)).toBe(true);
  expect(scopedTodos.map((t) => t.id).includes(todo2.id)).toBe(true);
});

test("assign todo other not in workspace", async () => {
  const creator = await createAccount();
  const assignee = await createAccount();

  const todo = await CreateTodoAction.create(creator.viewer, {
    text: "watch GOT",
    creatorID: creator.id,
    assigneeID: assignee.id,
    scopeID: assignee.id,
    scopeType: NodeType.Account,
  }).saveX();

  try {
    await ChangeTodoBountyAction.create(todo.viewer, todo, {
      bounty: 100,
    }).saveX();
    throw new Error(`should have thrown`);
  } catch (err) {
    expect((err as Error).message).toBe(
      `bounties can only be created in a workspace scope`,
    );
  }
});

test("create todo self in workspace", async () => {
  await createTodoSelfInWorkspace();
});

test("assign bounty self in workspace", async () => {
  const todo = await createTodoSelfInWorkspace();

  try {
    await ChangeTodoBountyAction.create(todo.viewer, todo, {
      bounty: 100,
    }).saveX();
    throw new Error(`should have thrown`);
  } catch (err) {
    expect((err as Error).message).toBe(
      `cannot assign bounty when you're the assignee`,
    );
  }
});

test("create todo for other in workspace", async () => {
  await createTodoOtherInWorksapce();
});

test("assign bounty other in workspace", async () => {
  const { todo } = await createTodoOtherInWorksapce();
  const editedTodo = await ChangeTodoBountyAction.create(todo.viewer, todo, {
    bounty: 100,
  }).saveX();
  expect(editedTodo.bounty).toBe(100);
});

test("assign bounty not enough credits", async () => {
  const { todo } = await createTodoOtherInWorksapce();

  try {
    await ChangeTodoBountyAction.create(todo.viewer, todo, {
      bounty: 1100,
    }).saveX();
    throw new Error(`should have thrown`);
  } catch (err) {
    expect((err as Error).message).toBe(
      `cannot create bounty when account doesn't have enough credits for it`,
    );
  }
});

async function changeCompleted(todo: Todo, completed: boolean) {
  todo = await ChangeTodoStatusAction.create(todo.viewer, todo, {
    completed: completed,
  }).saveX();

  expect(todo.completed).toBe(completed);

  const creator = await todo.loadCreatorX();
  const status = await creator.todoStatusFor(todo);
  expect(status).toBe(
    completed
      ? AccountTodoStatus.ClosedTodosDup
      : AccountTodoStatus.OpenTodosDup,
  );
  return todo;
}

test("mark as completed", async () => {
  let todo = await createTodoForSelf();

  todo = await changeCompleted(todo, true);

  // reopen
  todo = await changeCompleted(todo, false);
});

test("complete with bounty", async () => {
  let { todo } = await createTodoOtherInWorksapce();
  todo = await ChangeTodoBountyAction.create(todo.viewer, todo, {
    bounty: 100,
  }).saveX();

  await changeCompleted(todo, true);

  const assignee = await Account.loadX(
    new IDViewer(todo.assigneeID),
    todo.assigneeID,
  );
  const creator = await todo.loadCreatorX();
  // completing successfully transfered credits
  expect(assignee.credits).toBe(1100);
  expect(creator.credits).toBe(900);
});

test("complete with bounty, multiple in transaction", async () => {
  let { todo, todo2 } = await createTodoOtherInWorksapce();
  todo = await ChangeTodoBountyAction.create(todo.viewer, todo, {
    bounty: 100,
  }).saveX();
  todo2 = await ChangeTodoBountyAction.create(todo2.viewer, todo2, {
    bounty: 100,
  }).saveX();

  const tx = new Transaction(todo.viewer, [
    ChangeTodoStatusAction.create(todo.viewer, todo, {
      completed: true,
    }),
    ChangeTodoStatusAction.create(todo.viewer, todo2, {
      completed: true,
    }),
  ]);
  await tx.run();

  const assignee1 = await Account.loadX(
    new IDViewer(todo.assigneeID),
    todo.assigneeID,
  );
  const assignee2 = await Account.loadX(
    new IDViewer(todo2.assigneeID),
    todo2.assigneeID,
  );
  const creator = await todo.loadCreatorX();
  // completing successfully transfered credits
  expect(assignee1.credits).toBe(1100);
  expect(assignee2.credits).toBe(1100);
  expect(creator.credits).toBe(800);
});

test("rename todo", async () => {
  let todo = await createTodoForSelf();

  todo = await RenameTodoStatusAction.create(todo.viewer, todo, {
    text: "re-watch GOT",
  }).saveX();

  expect(todo.text).toBe("re-watch GOT");
});

test("delete todo", async () => {
  let todo = await createTodoForSelf();
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
  let todo = await createTodoForSelf();
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
    [1, 2, 3, 4, 5].map(() => createTodoForSelf({ creatorID: account.id })),
  );
  expect(todos.length).toBe(5);

  await changeCompleted(todos[0], true);

  await changeCompleted(todos[4], true);

  const openTodos = await Todo.loadCustom(
    account.viewer,
    query.And(
      query.Eq("assignee_id", account.id),
      query.Eq("completed", false),
    ),
  );
  expect(openTodos.length).toBe(3);

  const openTodosCount = await Todo.loadCustomCount(
    query.And(
      query.Eq("assignee_id", account.id),
      query.Eq("completed", false),
    ),
  );
  expect(openTodosCount).toBe(3);

  const closedTodos = await Todo.loadCustom(
    account.viewer,
    query.And(query.Eq("assignee_id", account.id), query.Eq("completed", true)),
  );
  expect(closedTodos.length).toBe(2);

  const closedTodosCount = await Todo.loadCustomCount(
    query.And(query.Eq("assignee_id", account.id), query.Eq("completed", true)),
  );
  expect(closedTodosCount).toBe(2);

  const orderedOpenedTodos = await Todo.loadCustom(account.viewer, {
    clause: query.And(
      query.Eq("assignee_id", account.id),
      query.Eq("completed", false),
    ),
    orderby: [
      {
        column: "created_at",
        direction: "DESC",
      },
    ],
  });
  expect(orderedOpenedTodos.length).toBe(3);
});

test("tags", async () => {
  const todo = await createTodoForSelf();
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

  const count3 = await todo
    .queryTags()
    .withoutTransformations()
    .queryRawCount();
  const tags3 = await todo.queryTags().withoutTransformations().queryEnts();
  const edges3 = await todo.queryTags().withoutTransformations().queryEdges();

  // the deleted one is still in the db, just not returned by queries
  // if we ask for it, we can get it...
  expect(count3).toBe(4);
  expect(edges3.length).toBe(4);
  expect(tags3.length).toBe(4);
  expect(edges3.filter((edge) => edge.deletedAt !== null).length).toBe(1);

  // reeally delete
  const action = TodoRemoveTagAction.create(todo.viewer, todo);
  action.builder.removeTagID(tag.id, {
    disableTransformations: true,
  });
  await action.saveX();
  todo.viewer.context?.cache?.clearCache();

  const count4 = await todo.queryTags().queryRawCount();
  const tags4 = await todo.queryTags().queryEnts();
  const edges4 = await todo.queryTags().queryEdges();

  expect(edges4.length).toBe(3);
  expect(edges4.every((edge) => edge.deletedAt === null)).toBe(true);
  expect(count4).toBe(3);
  expect(tags4.length).toBe(3);

  // fetch without tranformations
  // no longer there...
  const count5 = await todo
    .queryTags()
    .withoutTransformations()
    .queryRawCount();
  const tags5 = await todo.queryTags().withoutTransformations().queryEnts();
  const edges5 = await todo.queryTags().withoutTransformations().queryEdges();

  // the deleted one is still in the db, just not returned by queries
  // if we ask for it, we can get it...
  expect(count5).toBe(3);
  expect(edges5.length).toBe(3);
  expect(tags5.length).toBe(3);
  expect(edges5.filter((edge) => edge.deletedAt !== null).length).toBe(0);
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
  const assigned = await account.queryTodosAssigned().queryEnts();
  expect(assigned.map((t) => t.id).sort()).toEqual(
    [todo.id, todo2.id, todo3.id].sort(),
  );
});
