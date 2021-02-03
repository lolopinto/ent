import { DB } from "@lolopinto/ent";
import {
  expectMutation,
  expectQueryFromRoot,
} from "@lolopinto/ent-graphql-tests";
import { createAndInvitePlusGuests } from "src/testutils";
import schema from "src/graphql/schema";
import { AuthCode } from "src/ent/auth_code";
import { encodeGQLID } from "@lolopinto/ent/graphql";
import { PassportStrategyHandler } from "@lolopinto/ent-passport";
import supertest from "supertest";
import { Guest } from "src/ent";

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
      init: PassportStrategyHandler.testInitJWTFunction({
        secretOrKey: "secret",
        loaderOptions: Guest.loaderOptions(),
        authOptions: {
          session: false,
        },
      }),
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
