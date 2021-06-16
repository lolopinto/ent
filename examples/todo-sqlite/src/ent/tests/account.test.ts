import EditAccountAction from "../account/actions/edit_account_action";
import DeleteAccountAction from "../account/actions/delete_account_action";
import { Account } from "../internal";
import { createAccount } from "../testutils/util";

beforeAll(() => {
  process.env.DB_CONNECTION_STRING = `sqlite:///todo.db`;
});

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
  await DeleteAccountAction.create(account.viewer, account).saveX();
  let reloaded = await Account.load(account.viewer, account.id);
  expect(reloaded).toBeNull();
});
