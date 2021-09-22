import { Express } from "express";
import supertest from "supertest";
import { DB, LoggedOutViewer } from "@snowtop/ent";
import { encodeGQLID } from "@snowtop/ent/graphql";
import schema from "../generated/schema";
import { clearAuthHandlers } from "@snowtop/ent/auth";
import {
  queryRootConfig,
  expectQueryFromRoot,
  expectMutation,
} from "@snowtop/ent-graphql-tests";
import { PassportAuthHandler } from "@snowtop/ent-passport";
import CreateUserAction, {
  UserCreateInput,
} from "../../ent/user/actions/create_user_action";
import { randomEmail, random, randomPhoneNumber } from "../../util/random";
import { User } from "../../ent/";

// TODO we need something that does this by default for all tests
afterAll(async () => {
  await DB.getInstance().endPool();
});

afterEach(() => {
  clearAuthHandlers();
});

function getUserRootConfig(
  user: User,
  partialConfig?: Partial<queryRootConfig>,
): queryRootConfig {
  return {
    schema: schema,
    root: "node",
    args: {
      id: encodeGQLID(user),
    },
    inlineFragmentRoot: "User",
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
    phoneNumber: randomPhoneNumber(),
    ...input,
  }).saveX();
}

test("no viewer", async () => {
  const user = await createUser();

  await expectQueryFromRoot(
    getUserRootConfig(user, {
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
    ["viewerID", null],
  );
});

test("right credentials", async () => {
  const pw = random();
  const user = await createUser({
    password: pw,
  });

  let st: supertest.SuperTest<supertest.Test>;

  st = await expectMutation(
    {
      // pass a function that takes a server that keeps track of cookies etc
      // and use that for this request
      test: (app: Express) => {
        return supertest.agent(app);
      },
      init: PassportAuthHandler.testInitSessionBasedFunction("secret", {
        loadOptions: User.loaderOptions(),
      }),
      mutation: "userAuth",
      schema,
      args: {
        emailAddress: user.emailAddress,
        password: pw,
      },
    },
    ["viewerID", encodeGQLID(user)],
  );

  // send to authed server from above
  // and user is logged in and can make queries!
  await expectQueryFromRoot(
    getUserRootConfig(user, {
      // pass the agent used above to the same server and user is authed!
      test: st,
    }),
    ["id", encodeGQLID(user)],
    ["emailAddress", user.emailAddress],
  );

  // independent server, nothing is saved. user isn't logged in
  await expectQueryFromRoot(
    getUserRootConfig(user, {
      rootQueryNull: true,
    }),
    ["id", null],
  );
});
