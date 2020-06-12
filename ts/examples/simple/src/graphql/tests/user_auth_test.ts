import schema from "src/graphql/schema";
import {
  queryRootConfig,
  expectQueryFromRoot,
  expectMutation,
} from "src/graphql_test_utils";
import { ID, Viewer } from "ent/ent";
import CreateUserAction, {
  UserCreateInput,
} from "src/ent/user/actions/create_user_action";
import { randomEmail, random } from "src/util/random";
import DB from "ent/db";
import { clearAuthHandlers } from "ent/auth";
import { LoggedOutViewer } from "ent/viewer";
import User from "src/ent/user";

// TODO we need something that does this by default for all tests
afterAll(async () => {
  await DB.getInstance().endPool();
});

afterEach(() => {
  clearAuthHandlers();
});

// TODO cookies?
function getUserRootConfig(
  userID: ID,
  partialConfig?: Partial<queryRootConfig>,
): queryRootConfig {
  return {
    schema: schema,
    root: "user",
    args: {
      id: userID,
    },
    ...partialConfig,
  };
}

const loggedOutViewer = new LoggedOutViewer();
async function createUser(input?: Partial<UserCreateInput>): Promise<User> {
  return await CreateUserAction.create(loggedOutViewer, {
    firstName: "first",
    lastName: "last",
    emailAddress: randomEmail(),
    password: random(),
    ...input,
  }).saveX();
}

// no specified viewer so can't load anything here
test("no viewer", async () => {
  const user = await createUser();

  await expectQueryFromRoot(
    getUserRootConfig(user.id, {
      rootQueryNull: true,
    }),
    ["id", null],
  );
});

test("wrong login credentials", async () => {
  const user = await createUser();

  await expectMutation(
    {
      mutation: "userAuth",
      schema,
      args: {
        emailAddress: user.emailAddress,
        password: random(),
      },
      expectedError: /not the right credentials/,
    },
    ["token", null],
    ["viewerID", null],
  );
});
// test no viewer vs with viewer
