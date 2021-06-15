import { LoggedOutViewer } from "@lolopinto/ent";
import CreateAccountAction from "src/ent/account/actions/create_account_action";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { validate } from "uuid";
import EditAccountAction from "../account/actions/edit_account_action";
import DeleteAccountAction from "../account/actions/delete_account_action";
import { Account } from "../internal";
beforeAll(() => {
  process.env.DB_CONNECTION_STRING = `sqlite:///todo.db`;
});

function randomPhoneNumber(): string {
  const phone = Math.random().toString(10).substring(2, 12);
  const phoneNumber = parsePhoneNumberFromString(phone, "US");
  return phoneNumber!.format("E.164");
}

async function createAccount() {
  const number = randomPhoneNumber();
  const account = await CreateAccountAction.create(new LoggedOutViewer(), {
    name: "Jon Snow",
    phoneNumber: number,
  }).saveX();
  expect(account.name).toBe("Jon Snow");
  expect(account.phoneNumber).toBe(number);
  expect(validate(account.id as string)).toBe(true);
  return account;
}

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
