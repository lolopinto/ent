import { LoggedOutViewer, ID, IDViewer, Viewer } from "@snowtop/ent";
import {
  CreateAccountAction,
  AccountCreateInput,
} from "src/ent/account/actions/create_account_action";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { validate } from "uuid";
import {
  CreateTodoAction,
  TodoCreateInput,
} from "src/ent/todo/actions/create_todo_action";
import { CreateTagAction } from "../tag/actions/create_tag_action";
import { Account } from "src/ent";
import { CreateWorkspaceAction } from "../workspace/actions/create_workspace_action";
import { randomInt } from "crypto";
import { NodeType } from "../generated/types";

export function randomPhoneNumber(): string {
  const phone = Math.random().toString(10).substring(2, 12);
  const phoneNumber = parsePhoneNumberFromString(phone, "US");
  return phoneNumber!.format("E.164");
}

export async function createAccount(input?: Partial<AccountCreateInput>) {
  const number = randomPhoneNumber();
  const account = await CreateAccountAction.create(new LoggedOutViewer(), {
    name: "Jon Snow",
    phoneNumber: number,
    ...input,
  }).saveX();
  expect(account.name).toBe(input?.name ?? "Jon Snow");
  expect(account.phoneNumber).toBe(input?.phoneNumber ?? number);
  expect(validate(account.id as string)).toBe(true);
  expect(account.createdAt).toBeInstanceOf(Date);
  expect(account.updatedAt).toBeInstanceOf(Date);
  // each account starts with 1000 credits
  expect(account.credits).toBe(1000);
  return account;
}

export async function createWorkspace(account?: Account) {
  if (!account) {
    account = await createAccount();
  }
  const workspace = await CreateWorkspaceAction.create(account.viewer, {
    name: "test",
    slug: `fun-workspace-${randomInt(1000000000000)}`,
  }).saveX();
  expect(workspace.creatorId).toBe(account.id);
  expect(workspace.viewerCreatorId).toBe(account.id);
  expect(workspace.name).toBe("test");

  const createdWorkspaces = await account.queryCreatedWorkspaces().queryEnts();
  expect(createdWorkspaces.length).toBe(1);
  expect(createdWorkspaces[0].id).toBe(workspace.id);

  return workspace;
}

export async function createTodoForSelf(opts?: Partial<TodoCreateInput>) {
  let creatorId: ID;
  if (opts?.creatorId) {
    creatorId = opts.creatorId as ID;
  } else {
    const account = await createAccount();
    creatorId = account.id;
  }
  const text = opts?.text || "watch Game of Thrones";
  const todo = await CreateTodoAction.create(new IDViewer(creatorId), {
    text,
    creatorId: creatorId,
    assigneeId: creatorId,
    scopeId: creatorId,
    scopeType: NodeType.Account,
    ...opts,
  }).saveX();
  expect(todo.text).toBe(text);
  expect(todo.creatorId).toBe(creatorId);
  expect(todo.completed).toBe(false);
  expect(todo.assigneeId).toBe(creatorId);
  expect(todo.scopeId).toBe(creatorId);
  expect(todo.scopeType).toBe(NodeType.Account);

  const creator = await todo.loadCreatorX();
  const status = await creator.todoStatusFor(todo);
  expect(status).toBeNull();

  const scopedEnts = await todo.queryTodoScope().queryEnts();
  expect(scopedEnts.length).toBe(1);
  expect(scopedEnts[0].id).toBe(creatorId);
  return todo;
}

export async function createTodoSelfInWorkspace() {
  const creator = await createAccount();
  const workspace = await CreateWorkspaceAction.create(creator.viewer, {
    name: "test",
    slug: `fun-workspace-${randomInt(1000000000000)}`,
  }).saveX();

  const text = "watch Game of Thrones";
  const todo = await CreateTodoAction.create(creator.viewer, {
    text,
    creatorId: creator.id,
    assigneeId: creator.id,
    scopeId: workspace.id,
    scopeType: NodeType.Workspace,
  }).saveX();
  expect(todo.text).toBe(text);
  expect(todo.creatorId).toBe(creator.id);
  expect(todo.completed).toBe(false);
  expect(todo.assigneeId).toBe(creator.id);
  expect(todo.scopeId).toBe(workspace.id);
  expect(todo.scopeType).toBe(NodeType.Workspace);

  const status = await creator.todoStatusFor(todo);
  expect(status).toBeNull();

  const scopedEnts = await todo.queryTodoScope().queryEnts();
  expect(scopedEnts.length).toBe(1);
  expect(scopedEnts[0].id).toBe(workspace.id);

  return todo;
}

export async function createTag(displayName: string, account?: Account) {
  if (!account) {
    account = await createAccount();
  }

  const tag = await CreateTagAction.create(account.viewer, {
    ownerId: account.id,
    displayName,
  }).saveX();
  expect(tag.displayName).toBe(displayName);
  expect(tag.canonicalName).toBe(displayName.trim().toLowerCase());
  expect(tag.ownerId).toBe(account.id);
  return tag;
}

export async function createTodoOtherInWorksapce() {
  const creator = await createAccount();
  const assignee = await createAccount();
  const workspace = await createWorkspace(creator);

  const todo = await CreateTodoAction.create(creator.viewer, {
    text: "watch GOT",
    creatorId: creator.id,
    assigneeId: assignee.id,
    scopeId: workspace.id,
    scopeType: NodeType.Workspace,
  }).saveX();
  expect(todo.text).toBe("watch GOT");
  expect(todo.creatorId).toBe(creator.id);
  expect(todo.completed).toBe(false);
  expect(todo.assigneeId).toBe(assignee.id);
  expect(todo.scopeId).toBe(workspace.id);
  expect(todo.scopeType).toBe(NodeType.Workspace);

  const scopedEnts = await todo.queryTodoScope().queryEnts();
  expect(scopedEnts.length).toBe(1);
  expect(scopedEnts[0].id).toBe(workspace.id);

  const assignee2 = await createAccount();

  const todo2 = await CreateTodoAction.create(creator.viewer, {
    text: "watch GOT",
    creatorId: creator.id,
    assigneeId: assignee2.id,
    scopeId: workspace.id,
    scopeType: NodeType.Workspace,
  }).saveX();
  expect(todo2.text).toBe("watch GOT");
  expect(todo2.creatorId).toBe(creator.id);
  expect(todo2.completed).toBe(false);
  expect(todo2.assigneeId).toBe(assignee2.id);
  expect(todo2.scopeId).toBe(workspace.id);
  expect(todo2.scopeType).toBe(NodeType.Workspace);

  const scopedEnts2 = await todo2.queryTodoScope().queryEnts();
  expect(scopedEnts2.length).toBe(1);
  expect(scopedEnts2[0].id).toBe(workspace.id);

  const scopedTodos = await workspace.queryScopedTodos().queryEnts();
  expect(scopedTodos.length).toBe(2);
  expect(scopedTodos.map((t) => t.id).includes(todo.id)).toBe(true);
  expect(scopedTodos.map((t) => t.id).includes(todo2.id)).toBe(true);

  return { todo, todo2 };
}
