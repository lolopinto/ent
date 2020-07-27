import schema from "src/graphql/schema";
import {
  queryRootConfig,
  expectQueryFromRoot,
  expectMutation,
} from "src/graphql_test_utils";
import { ID } from "ent/ent";
import CreateUserAction, {
  UserCreateInput,
} from "src/ent/user/actions/create_user_action";
import { randomEmail, random } from "src/util/random";
import DB from "ent/db";
import { clearAuthHandlers } from "ent/auth";
import { LoggedOutViewer, IDViewer } from "ent/viewer";
import User from "src/ent/user";
import passport from "passport";
import { Express } from "express";
import { registerAuthHandler } from "ent/auth";
import { PassportStrategyHandler } from "ent/auth/passport";
import supertest from "supertest";
import { Strategy as JWTStrategy, ExtractJwt } from "passport-jwt";
import jwt from "jsonwebtoken";

// TODO we need something that does this by default for all tests
afterAll(async () => {
  await DB.getInstance().endPool();
});

afterEach(() => {
  clearAuthHandlers();
});

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
      mutation: "userAuthJWT",
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

test("right credentials", async () => {
  const pw = random();
  const user = await createUser({
    password: pw,
  });

  let st: supertest.SuperTest<supertest.Test>;
  let bearerToken: string | undefined;

  st = await expectMutation(
    {
      // pass a function that takes a server that keeps track of cookies etc
      // and use that for this request
      test: (app: Express) => {
        return supertest.agent(app);
      },
      init: (app: Express) => {
        app.use(passport.initialize());
        registerAuthHandler(
          "viewer",
          new PassportStrategyHandler(
            new JWTStrategy(
              {
                secretOrKey: "secret",
                jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
              },
              function(jwt_payload: {}, next) {
                return next(
                  null,
                  new IDViewer(jwt_payload["viewerID"].toString()),
                  {},
                );
              },
            ),
            { session: false },
          ),
        );
      },
      mutation: "userAuthJWT",
      schema,
      args: {
        emailAddress: user.emailAddress,
        password: pw,
      },
    },
    [
      "token",
      (token) => {
        const decoded = jwt.decode(token);
        expect(decoded).not.toBe(null);
        expect(decoded!["viewerID"]).toBe(user.id);

        bearerToken = token;
      },
    ],
    ["viewerID", user.id],
  );

  let headers = {};
  if (bearerToken) {
    headers["Authorization"] = `Bearer ${bearerToken}`;
  }
  // send to authed server from above
  // and user is logged in and can make queries!
  await expectQueryFromRoot(
    getUserRootConfig(user.id, {
      // pass the agent used above to the same server and user is authed!
      test: st,
      // also pass the token as a bearer token for authorization
      headers: headers,
    }),
    ["id", user.id],
    ["emailAddress", user.emailAddress],
  );

  // same server, no token, user isn't logged in
  await expectQueryFromRoot(
    getUserRootConfig(user.id, {
      // pass the agent used above to the same server and user is authed!
      test: st,
      rootQueryNull: true,
    }),
    ["id", null],
    ["emailAddress", null],
  );

  // independent server, nothing is saved + no token. user isn't logged in
  await expectQueryFromRoot(
    getUserRootConfig(user.id, {
      rootQueryNull: true,
    }),
    ["id", null],
  );
});
