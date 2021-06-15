import { LoggedOutViewer } from "@lolopinto/ent";
import CreateAccountAction from "src/ent/account/actions/create_account_action";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { validate } from "uuid";
import EditAccountAction from "../account/actions/edit_account_action";
import DeleteAccountAction from "../account/actions/delete_account_action";
import { Account } from "../internal";
import CreateTodoAction from "../todo/actions/create_todo_action";
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
  const account = await createAccount();
  const todo = await CreateTodoAction.create(account.viewer, {
    text: "watch Game of Thrones",
    creatorID: account.id,
  }).saveX();
  expect(todo.text).toBe("watch Game of Thrones");
  expect(todo.creatorID).toBe(account.id);
  // TODO need to convert sqlite...
  expect(todo.completed).toBe(0);
});
