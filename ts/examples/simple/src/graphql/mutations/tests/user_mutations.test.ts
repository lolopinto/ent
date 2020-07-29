import schema from "src/graphql/schema";
import DB from "ent/core/db";
import { LoggedOutViewer, IDViewer } from "ent/core/viewer";
import User from "src/ent/user";
import { randomEmail } from "src/util/random";
import CreateUserAction, {
  UserCreateInput,
} from "src/ent/user/actions/create_user_action";
import { expectMutation, mutationRootConfig } from "src/graphql_test_utils";
import { ID, Viewer } from "ent/core/ent";
import { clearAuthHandlers } from "ent/auth";

// TODO we need something that does this by default for all tests
afterAll(async () => {
  await DB.getInstance().endPool();
});

afterEach(() => {
  clearAuthHandlers();
});

const loggedOutViewer = new LoggedOutViewer();
async function create(input: UserCreateInput): Promise<User> {
  return await CreateUserAction.create(loggedOutViewer, input).saveX();
}

function getConfig(
  mutation: string,
  args: {},
  viewer: Viewer = loggedOutViewer,
  config?: Partial<mutationRootConfig>,
): mutationRootConfig {
  return {
    viewer: viewer,
    schema: schema,
    mutation: mutation,
    args,
    ...config,
  };
}

test("create", async () => {
  const email = randomEmail();

  await expectMutation(
    getConfig("userCreate", {
      firstName: "Jon",
      lastName: "Snow",
      emailAddress: email,
    }),
    [
      "user.id",
      async (id: ID) => {
        let vc = new IDViewer(id);
        await User.loadX(vc, id);
      },
    ],
    ["user.firstName", "Jon"],
    ["user.lastName", "Snow"],
    ["user.emailAddress", email],
  );
});

test("edit", async () => {
  const email = randomEmail();

  let user = await create({
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: email,
  });

  await expectMutation(
    getConfig(
      "userEdit",
      {
        userID: user.id,
        firstName: "Jon2",
      },
      new IDViewer(user.id),
    ),
    ["user.id", user.id],
    ["user.firstName", "Jon2"],
    ["user.lastName", "Snow"],
    ["user.emailAddress", email],
  );
});

test("edit no permissions, logged out viewer", async () => {
  const email = randomEmail();

  let user = await create({
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: email,
  });

  await expectMutation(
    getConfig(
      "userEdit",
      {
        userID: user.id,
        firstName: "Jon2",
      },
      loggedOutViewer,
      {
        expectedStatus: 500,
        expectedError: /not visible for privacy reasons/,
      },
    ),
    ["user.id", null],
  );
});

test("edit no permissions, other viewer", async () => {
  const email = randomEmail();

  let user = await create({
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: email,
  });

  let user2 = await create({
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: randomEmail(),
  });

  await expectMutation(
    getConfig(
      "userEdit",
      {
        userID: user.id,
        firstName: "Jon2",
      },
      new IDViewer(user2.id),
      {
        expectedStatus: 500,
        expectedError: /not visible for privacy reasons/,
      },
    ),
    ["user.id", null],
  );
});

test("delete", async () => {
  const email = randomEmail();

  let user = await create({
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: email,
  });

  await expectMutation(
    getConfig(
      "userDelete",
      {
        userID: user.id,
      },
      new IDViewer(user.id),
    ),
    [
      "deletedUserID",
      async (id: ID) => {
        let user = await User.load(new IDViewer(id), id);
        expect(user).toBe(null);
      },
    ],
  );
});

test("delete. other user no permissions", async () => {
  const email = randomEmail();

  let user = await create({
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: email,
  });

  let user2 = await create({
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: randomEmail(),
  });

  await expectMutation(
    getConfig(
      "userDelete",
      {
        userID: user.id,
      },
      new IDViewer(user2.id),
      {
        expectedStatus: 500,
        expectedError: /not visible for privacy reasons/,
      },
    ),
    ["deletedUserID", null],
  );
});
