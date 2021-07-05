import { LoggedOutViewer, ID, IDViewer } from "@snowtop/ent";
import CreateAccountAction from "src/ent/account/actions/create_account_action";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { validate } from "uuid";
import CreateTodoAction, {
  TodoCreateInput,
} from "src/ent/todo/actions/create_todo_action";

function randomPhoneNumber(): string {
  const phone = Math.random().toString(10).substring(2, 12);
  const phoneNumber = parsePhoneNumberFromString(phone, "US");
  return phoneNumber!.format("E.164");
}

export async function createAccount() {
  const number = randomPhoneNumber();
  const account = await CreateAccountAction.create(new LoggedOutViewer(), {
    name: "Jon Snow",
    phoneNumber: number,
  }).saveX();
  expect(account.name).toBe("Jon Snow");
  expect(account.phoneNumber).toBe(number);
  expect(validate(account.id as string)).toBe(true);
  expect(account.createdAt).toBeInstanceOf(Date);
  expect(account.updatedAt).toBeInstanceOf(Date);
  return account;
}

export async function createTodo(opts?: Partial<TodoCreateInput>) {
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
    ...opts,
  }).saveX();
  expect(todo.text).toBe(text);
  expect(todo.creatorID).toBe(creatorID);
  expect(todo.completed).toBe(false);

  return todo;
}
