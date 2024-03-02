import { randomEmail, randomPhoneNumber } from "src/util/random";
import { User } from "..";
import CreateUserAction, {
  UserCreateInput,
} from "../user/actions/create_user_action";
import { LoggedOutExampleViewer } from "src/viewer/viewer";
import CreateAuthCodeAction from "../auth_code/actions/create_auth_code_action";

async function createUser(opts?: Partial<UserCreateInput>): Promise<User> {
  let input: UserCreateInput = {
    firstName: "first",
    lastName: "last",
    emailAddress: randomEmail(),
    password: "pa$$w0rd",
    phoneNumber: randomPhoneNumber(),
    ...opts,
  };
  return CreateUserAction.create(new LoggedOutExampleViewer(), input).saveX();
}

function newCode() {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += Math.floor(Math.random() * 10);
  }
  return code;
}

async function createAuthCode() {
  const user = await createUser();

  const code = newCode();

  const authCode = await CreateAuthCodeAction.create(user.viewer, {
    emailAddress: user.emailAddress,
    userId: user.id,
    code,
  }).saveX();

  expect(authCode.code).toBe(code);
  expect(authCode.emailAddress).toBe(user.emailAddress);

  return authCode;
}

test("create", async () => {
  await createAuthCode();
});

test("create -> edit", async () => {
  const authCode = await createAuthCode();

  const code2 = newCode();

  const user = await authCode.loadUserX();

  const authCode2 = await CreateAuthCodeAction.create(authCode.viewer, {
    emailAddress: user.emailAddress,
    userId: user.id,
    code: code2,
  }).saveX();
  // same object
  expect(authCode2.id).toBe(authCode.id);
  expect(authCode2.emailAddress).toBe(authCode.emailAddress);
  expect(authCode2.userId).toBe(authCode.userId);

  // TODO fix this, this should not change since it should be an edit
  // expect(authCode2.createdAt).toBe(authCode.createdAt);

  // new code
  expect(authCode2.code).toBe(code2);
  expect(authCode2.updatedAt).not.toBe(authCode.updatedAt);
});
