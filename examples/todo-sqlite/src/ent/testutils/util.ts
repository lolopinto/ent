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
  expect(workspace.creatorID).toBe(account.id);
  expect(workspace.viewerCreatorID).toBe(account.id);
  expect(workspace.name).toBe("test");

  const createdWorkspaces = await account.queryCreatedWorkspaces().queryEnts();
  expect(createdWorkspaces.length).toBe(1);
  expect(createdWorkspaces[0].id).toBe(workspace.id);

  return workspace;
}

export async function createTodoForSelf(opts?: Partial<TodoCreateInput>) {
  let creatorID: ID;
  if (opts?.creatorID) {
    creatorID = opts.creatorID as ID;
  } else {
    const account = await createAccount();
    creatorID = account.id;
  }
  const text = opts?.text || "watch Game of Thrones";
  const todo = await CreateTodoAction.create(new IDViewer(creatorID), {
    text,
    creatorID: creatorID,
    assigneeID: creatorID,
    scopeID: creatorID,
    scopeType: NodeType.Account,
    ...opts,
  }).saveX();
  expect(todo.text).toBe(text);
  expect(todo.creatorID).toBe(creatorID);
  expect(todo.completed).toBe(false);
  expect(todo.assigneeID).toBe(creatorID);
  expect(todo.scopeID).toBe(creatorID);
  expect(todo.scopeType).toBe(NodeType.Account);

  const creator = await todo.loadCreatorX();
  const status = await creator.todoStatusFor(todo);
  expect(status).toBeNull();

  const scopedEnts = await todo.queryTodoScope().queryEnts();
  expect(scopedEnts.length).toBe(1);
  expect(scopedEnts[0].id).toBe(creatorID);
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
    creatorID: creator.id,
    assigneeID: creator.id,
    scopeID: workspace.id,
    scopeType: NodeType.Workspace,
  }).saveX();
  expect(todo.text).toBe(text);
  expect(todo.creatorID).toBe(creator.id);
  expect(todo.completed).toBe(false);
  expect(todo.assigneeID).toBe(creator.id);
  expect(todo.scopeID).toBe(workspace.id);
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
    ownerID: account.id,
    displayName,
  }).saveX();
  expect(tag.displayName).toBe(displayName);
  expect(tag.canonicalName).toBe(displayName.trim().toLowerCase());
  expect(tag.ownerID).toBe(account.id);
  return tag;
}

export async function createTodoOtherInWorksapce() {
  const creator = await createAccount();
  const assignee = await createAccount();
  const workspace = await createWorkspace(creator);

  const todo = await CreateTodoAction.create(creator.viewer, {
    text: "watch GOT",
    creatorID: creator.id,
    assigneeID: assignee.id,
    scopeID: workspace.id,
    scopeType: NodeType.Workspace,
  }).saveX();
  expect(todo.text).toBe("watch GOT");
  expect(todo.creatorID).toBe(creator.id);
  expect(todo.completed).toBe(false);
  expect(todo.assigneeID).toBe(assignee.id);
  expect(todo.scopeID).toBe(workspace.id);
  expect(todo.scopeType).toBe(NodeType.Workspace);

  const scopedEnts = await todo.queryTodoScope().queryEnts();
  expect(scopedEnts.length).toBe(1);
  expect(scopedEnts[0].id).toBe(workspace.id);

  const assignee2 = await createAccount();

  const todo2 = await CreateTodoAction.create(creator.viewer, {
    text: "watch GOT",
    creatorID: creator.id,
    assigneeID: assignee2.id,
    scopeID: workspace.id,
    scopeType: NodeType.Workspace,
  }).saveX();
  expect(todo2.text).toBe("watch GOT");
  expect(todo2.creatorID).toBe(creator.id);
  expect(todo2.completed).toBe(false);
  expect(todo2.assigneeID).toBe(assignee2.id);
  expect(todo2.scopeID).toBe(workspace.id);
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
