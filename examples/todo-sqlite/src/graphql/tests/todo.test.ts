import { ID, IDViewer, LoggedOutViewer } from "@lolopinto/ent";
import CreateAccountAction from "src/ent/account/actions/create_account_action";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { validate } from "uuid";
import CreateTodoAction, {
  TodoCreateInput,
} from "src/ent/todo/actions/create_todo_action";
import { AccountToTodosQuery } from "src/ent";
import { expectMutation } from "@lolopinto/ent-graphql-tests";
import schema from "src/graphql/schema";
import { encodeGQLID } from "@lolopinto/ent/graphql";
import ChangeTodoStatusAction from "src/ent/todo/actions/change_todo_status_action";

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

async function createTodo(opts?: Partial<TodoCreateInput>) {
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
  // TODO need to convert sqlite...
  expect(todo.completed).toBe(0);

  return todo;
}

test("mark all as completed", async () => {
  const account = await createAccount();
  await Promise.all([
    createTodo({
      creatorID: account.id,
      text: "watch GOT",
    }),
    createTodo({
      creatorID: account.id,
      text: "take dog out",
    }),
    createTodo({
      creatorID: account.id,
      text: "take out trash",
    }),
    createTodo({
      creatorID: account.id,
      text: "call mom",
    }),
  ]);

  const loadedTodos = await AccountToTodosQuery.query(
    account.viewer,
    account,
  ).queryEnts();
  // TODO sqlite
  expect(loadedTodos.every((todo) => !todo.completed)).toBe(true);

  await expectMutation(
    {
      viewer: account.viewer,
      schema: schema,
      mutation: "todosMarkAllAs",
      args: { accountID: encodeGQLID(account), completed: true },
      disableInputWrapping: true,
    },
    ["id", encodeGQLID(account)],
  );

  const loadedTodos2 = await AccountToTodosQuery.query(
    account.viewer,
    account,
  ).queryEnts();

  // TODO sqlite
  expect(loadedTodos2.every((todo) => !!todo.completed)).toBe(true);

  await expectMutation(
    {
      viewer: account.viewer,
      schema: schema,
      mutation: "todosMarkAllAs",
      args: { accountID: encodeGQLID(account), completed: false },
      disableInputWrapping: true,
    },
    ["id", encodeGQLID(account)],
  );

  const loadedTodos3 = await AccountToTodosQuery.query(
    account.viewer,
    account,
  ).queryEnts();

  // TODO sqlite
  expect(loadedTodos3.every((todo) => !todo.completed)).toBe(true);
});

test("remove completed", async () => {
  const account = await createAccount();
  const todos = await Promise.all([
    createTodo({
      creatorID: account.id,
      text: "watch GOT",
    }),
    createTodo({
      creatorID: account.id,
      text: "take dog out",
    }),
    createTodo({
      creatorID: account.id,
      text: "take out trash",
    }),
    createTodo({
      creatorID: account.id,
      text: "call mom",
    }),
  ]);

  const count = await AccountToTodosQuery.query(
    account.viewer,
    account,
  ).queryCount();
  expect(count).toBe(4);

  // complete the first
  await ChangeTodoStatusAction.create(account.viewer, todos[0], {
    completed: true,
  }).saveX();

  await expectMutation(
    {
      viewer: account.viewer,
      schema: schema,
      mutation: "todosRemoveCompleted",
      args: { accountID: encodeGQLID(account) },
      disableInputWrapping: true,
    },
    ["id", encodeGQLID(account)],
    // now 3 because deleted now
    ["todos.rawCount", 3],
  );
});
