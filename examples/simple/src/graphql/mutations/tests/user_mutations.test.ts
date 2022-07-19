import { Viewer } from "@snowtop/ent";
import { expectMutation, mutationRootConfig } from "@snowtop/ent-graphql-tests";
import { clearAuthHandlers } from "@snowtop/ent/auth";
import { mustDecodeIDFromGQLID, encodeGQLID } from "@snowtop/ent/graphql";
import schema from "../../generated/schema";
import { User } from "../../../ent";
import { randomEmail, randomPhoneNumber } from "../../../util/random";
import CreateUserAction, {
  UserCreateInput,
} from "../../../ent/user/actions/create_user_action";
import { LoggedOutExampleViewer, ExampleViewer } from "../../../viewer/viewer";

afterEach(() => {
  clearAuthHandlers();
});

const loggedOutViewer = new LoggedOutExampleViewer();
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
        let vc = new ExampleViewer(decoded);
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
        id: encodeGQLID(user),
        firstName: "Jon2",
      },
      new ExampleViewer(user.id),
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
        id: encodeGQLID(user),
        firstName: "Jon2",
      },
      loggedOutViewer,
      {
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
        id: encodeGQLID(user),
        firstName: "Jon2",
      },
      new ExampleViewer(user2.id),
      {
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
        id: encodeGQLID(user),
      },
      new ExampleViewer(user.id),
    ),
    [
      "deletedUserID",
      async (id: string) => {
        expect(mustDecodeIDFromGQLID(id)).toBe(user.id);
        let deletedUser = await User.load(new ExampleViewer(user.id), user.id);
        expect(deletedUser).toBe(null);
      },
    ],
  );
});

test("delete 2", async () => {
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
      "userDelete2",
      {
        id: encodeGQLID(user),
        log: true,
      },
      new ExampleViewer(user.id),
    ),
    [
      "deletedUserID",
      async (id: string) => {
        expect(mustDecodeIDFromGQLID(id)).toBe(user.id);
        let deletedUser = await User.load(new ExampleViewer(user.id), user.id);
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
        id: encodeGQLID(user),
      },
      new ExampleViewer(user2.id),
      {
        expectedError: /not visible for privacy reasons/,
      },
    ),
    ["deletedUserID", null],
  );
});
