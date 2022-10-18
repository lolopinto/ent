import { createAccount, createWorkspace } from "../testutils/util";
import { Workspace } from "../workspace";
import DeleteWorkspaceAction from "../workspace/actions/delete_workspace_action";
import EditWorkspaceAction from "../workspace/actions/edit_workspace_action";

test("create", async () => {
  await createWorkspace();
});

test("add member + visible for member", async () => {
  const workspace = await createWorkspace();
  const member = await createAccount();

  expect(await Workspace.load(member.viewer, workspace.id)).toBeNull();

  expect(await workspace.queryMembers().queryCount()).toBe(0);

  const editAction = EditWorkspaceAction.create(
    workspace.viewer,
    workspace,
    {},
  );
  editAction.builder.addMember(member);
  await editAction.saveX();

  expect(await workspace.queryMembers().queryCount()).toBe(1);

  expect(await Workspace.load(member.viewer, workspace.id)).not.toBeNull();
});

test("only creator can edit|delete", async () => {
  const workspace = await createWorkspace();
  const rando = await createAccount();

  expect(
    await EditWorkspaceAction.create(rando.viewer, workspace, {}).valid(),
  ).toBe(false);

  expect(
    await DeleteWorkspaceAction.create(rando.viewer, workspace).valid(),
  ).toBe(false);
});

test("member cannot edit|delete", async () => {
  const workspace = await createWorkspace();

  const member = await createAccount();

  const editAction = EditWorkspaceAction.create(
    workspace.viewer,
    workspace,
    {},
  );
  editAction.builder.addMember(member);
  await editAction.saveX();

  expect(
    await EditWorkspaceAction.create(member.viewer, workspace, {}).valid(),
  ).toBe(false);

  expect(
    await DeleteWorkspaceAction.create(member.viewer, workspace).valid(),
  ).toBe(false);
});
