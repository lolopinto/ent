import EditAccountAction from "../account/actions/edit_account_action";
import DeleteAccountAction from "../account/actions/delete_account_action";
import { Account } from "../internal";
import { createAccount } from "../testutils/util";
import { advanceTo } from "jest-date-mock";

test("create", async () => {
  await createAccount();
});

test("edit", async () => {
  let account = await createAccount();
  account = await EditAccountAction.create(account.viewer, account, {
    name: "Aegon Targaryen",
  }).saveX();
  expect(account.name).toBe("Aegon Targaryen");
});

test("delete", async () => {
  let account = await createAccount();
  expect(account.getDeletedAt()).toBeNull();

  const d = new Date();
  advanceTo(d);

  await DeleteAccountAction.create(account.viewer, account).saveX();
  let reloaded = await Account.load(account.viewer, account.id);
  expect(reloaded).toBeNull();

  const transformed = await Account.loadNoTransform(account.viewer, account.id);
  expect(transformed).not.toBeNull();
  expect(transformed?.getDeletedAt()).toEqual(d);

  // then really delete
  await DeleteAccountAction.create(
    account.viewer,
    account,
  ).saveWithoutTransformX();
  const transformed2 = await Account.loadNoTransform(
    account.viewer,
    account.id,
  );
  expect(transformed2).toBeNull();
});

test("really delete", async () => {
  let account = await createAccount();
  expect(account.getDeletedAt()).toBeNull();

  const d = new Date();
  advanceTo(d);

  await DeleteAccountAction.create(
    account.viewer,
    account,
  ).saveWithoutTransformX();
  let reloaded = await Account.load(account.viewer, account.id);
  expect(reloaded).toBeNull();

  const transformed = await Account.loadNoTransform(account.viewer, account.id);
  expect(transformed).toBeNull();
});
