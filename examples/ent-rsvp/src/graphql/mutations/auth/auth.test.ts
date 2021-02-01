import { DB, IDViewer } from "@lolopinto/ent";
import {
  expectMutation,
  expectQueryFromRoot,
} from "@lolopinto/ent-graphql-tests";
import { createAndInvitePlusGuests } from "src/testutils";
import schema from "src/graphql/schema";
import { AuthCode } from "src/ent/auth_code";
import { encodeGQLID } from "@lolopinto/ent/graphql";
import { PassportStrategyHandler } from "@lolopinto/ent/auth";
import { Strategy as JWTStrategy, ExtractJwt } from "passport-jwt";
import passport from "passport";
import { Express } from "express";
import { registerAuthHandler } from "@lolopinto/ent/auth";
import supertest from "supertest";

afterAll(async () => {
  await DB.getInstance().endPool();
});

test("logged out viewer", async () => {
  await expectQueryFromRoot(
    {
      root: "viewer",
      schema,
      args: {},
      nullQueryPaths: ["guest"],
    },
    ["guest.id", null],
  );
});

test("log guest in", async () => {
  const [activity, guests] = await createAndInvitePlusGuests(0);
  const guest = guests[0];

  const code = await AuthCode.loadFromGuestIDX(guest.viewer, guest.id);

  expect(code.emailAddress).toBe(guest.emailAddress);
  expect(code.guestID).toBe(guest.id);

  let jwtToken: string = "";
  let st: supertest.SuperTest<supertest.Test>;

  st = await expectMutation(
    {
      mutation: "authGuest",
      schema,
      args: {
        emailAddress: code.emailAddress,
        code: code.code,
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
    },
    // guest is returned as viewer
    ["viewer.guest.id", encodeGQLID(guest)],
    [
      "token",
      function(token) {
        jwtToken = token;
      },
    ],
  );

  let headers = {};
  if (jwtToken) {
    headers["Authorization"] = `Bearer ${jwtToken}`;
  }

  // guest is logged in now and subsequent query returns viewer
  await expectQueryFromRoot(
    {
      root: "viewer",
      schema,
      args: {},
      test: st,
      headers: headers,
    },
    ["guest.id", encodeGQLID(guest)],
    ["guest.emailAddress", guest.emailAddress],
  );
});
