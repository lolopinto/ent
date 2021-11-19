import { DB, Viewer, LoggedOutViewer, IDViewer } from "@snowtop/ent";
import { expectMutation, mutationRootConfig } from "@snowtop/ent-graphql-tests";
import { clearAuthHandlers } from "@snowtop/ent/auth";
import { mustDecodeIDFromGQLID, encodeGQLID } from "@snowtop/ent/graphql";
import schema from "../../generated/schema";
import { User } from "../../../ent";
import { randomEmail, randomPhoneNumber } from "../../../util/random";
import CreateUserAction, {
  UserCreateInput,
} from "../../../ent/user/actions/create_user_action";

// TODO we need something that does this by default for all tests
afterAll(async () => {
  await DB.getInstance().endPool();
});

afterEach(() => {
  clearAuthHandlers();
});

const loggedOutViewer = new LoggedOutViewer();
async function create(opts: Partial<UserCreateInput>): Promise<User> {
  let input: UserCreateInput = {
    firstName: "first",
    lastName: "last",
    emailAddress: randomEmail(),
    password: "pa$$w0rd",
    phoneNumber: randomPhoneNumber(),
    ...opts,
  };
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
  const phoneNumber = randomPhoneNumber();

  await expectMutation(
    getConfig("userCreate", {
      firstName: "Jon",
      lastName: "Snow",
      emailAddress: email,
      phoneNumber: phoneNumber,
      password: "pa$$w0rd",
    }),
    [
      "user.id",
      async (id: string) => {
        const decoded = mustDecodeIDFromGQLID(id);
        let vc = new IDViewer(decoded);
        await User.loadX(vc, decoded);
      },
    ],
    ["user.firstName", "Jon"],
    ["user.lastName", "Snow"],
    ["user.emailAddress", email],
    ["user.phoneNumber", phoneNumber],
    // we just gonna assume password worked lol
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
        userID: encodeGQLID(user),
        firstName: "Jon2",
      },
      new IDViewer(user.id),
    ),
    ["user.id", encodeGQLID(user)],
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
    password: "pa$$w0rd",
    phoneNumber: randomPhoneNumber(),
  });

  await expectMutation(
    getConfig(
      "userEdit",
      {
        userID: encodeGQLID(user),
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
  });

  await expectMutation(
    getConfig(
      "userEdit",
      {
        userID: encodeGQLID(user),
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
    password: "pa$$w0rd",
    phoneNumber: randomPhoneNumber(),
  });

  await expectMutation(
    getConfig(
      "userDelete",
      {
        userID: encodeGQLID(user),
      },
      new IDViewer(user.id),
    ),
    [
      "deletedUserID",
      async (id: string) => {
        expect(mustDecodeIDFromGQLID(id)).toBe(user.id);
        let deletedUser = await User.load(new IDViewer(user.id), user.id);
        expect(deletedUser).toBe(null);
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
  });

  await expectMutation(
    getConfig(
      "userDelete",
      {
        userID: encodeGQLID(user),
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
