import EditAccountAction from "../account/actions/edit_account_action";
import DeleteAccountAction from "../account/actions/delete_account_action";
import { Account } from "../internal";
import { createAccount } from "../testutils/util";
import { advanceTo } from "jest-date-mock";

test("create", async () => {
  await createAccount();
});

test("create with prefs", async () => {
  const account = await createAccount({
    accountPrefs: {
      finishedNux: false,
      enableNotifs: true,
      preferredLanguage: "fr_FR",
    },
  });
  expect(account.accountPrefs).toStrictEqual({
    finishedNux: false,
    enableNotifs: true,
    preferredLanguage: "fr_FR",
  });
});

test("field privacy", async () => {
  // viewer can see their own phone number and account state. no one else can
  const account1 = await createAccount();
  expect(account1.phoneNumber).not.toBeNull();
  expect(account1.accountState).not.toBeNull();

  const account2 = await createAccount();
  expect(account2.phoneNumber).not.toBeNull();
  expect(account2.accountState).not.toBeNull();

  const fromOther = await Account.loadX(account1.viewer, account2.id);
  expect(fromOther.phoneNumber).toBeNull();
  expect(fromOther.accountState).toBeNull();
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
