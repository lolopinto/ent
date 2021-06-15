import { LoggedOutViewer } from "@lolopinto/ent";
import CreateAccountAction from "src/ent/account/actions/create_account_action";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { validate } from "uuid";
import CreateTodoAction from "../todo/actions/create_todo_action";
import ChangeTodoStatusAction from "../todo/actions/change_todo_status_action";
import { TodoChangeStatusInputType } from "src/graphql/mutations/generated/todo/todo_change_status_type";
import RenameTodoStatusAction from "../todo/actions/rename_todo_status_action";
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

async function createTodo() {
  const account = await createAccount();
  const todo = await CreateTodoAction.create(account.viewer, {
    text: "watch Game of Thrones",
    creatorID: account.id,
  }).saveX();
  expect(todo.text).toBe("watch Game of Thrones");
  expect(todo.creatorID).toBe(account.id);
  // TODO need to convert sqlite...
  expect(todo.completed).toBe(0);

  return todo;
}

test("create", async () => {
  await createTodo();
});

test("mark as completed", async () => {
  let todo = await createTodo();

  todo = await ChangeTodoStatusAction.create(todo.viewer, todo, {
    completed: true,
  }).saveX();

  // TODO boolean
  expect(todo.completed).toBe(1);

  // reopen
  todo = await ChangeTodoStatusAction.create(todo.viewer, todo, {
    completed: false,
  }).saveX();

  // TODO boolean
  expect(todo.completed).toBe(0);
});

test("rename todo", async () => {
  let todo = await createTodo();

  todo = await RenameTodoStatusAction.create(todo.viewer, todo, {
    text: "re-watch GOT",
  }).saveX();

  expect(todo.text).toBe("re-watch GOT");
});
