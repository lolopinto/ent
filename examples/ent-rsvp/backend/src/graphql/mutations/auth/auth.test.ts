import { Data, DB } from "@snowtop/ent";
import {
  expectMutation,
  expectQueryFromRoot,
} from "@snowtop/ent-graphql-tests";
import { createUser, createAndInvitePlusGuests } from "src/testutils";
import schema from "src/graphql/generated/schema";
import { AuthCode } from "src/ent/auth_code";
import { encodeGQLID } from "@snowtop/ent/graphql";
import { PassportStrategyHandler } from "@snowtop/ent-passport";
import supertest from "supertest";
import { Guest, User } from "src/ent";

afterAll(async () => {
  await DB.getInstance().endPool();
});

async function confirmNoViewer(st?: supertest.SuperTest<supertest.Test>) {
  await expectQueryFromRoot(
    {
      root: "viewer",
      schema,
      args: {},
      test: st,
      nullQueryPaths: ["guest", "user"],
    },
    ["guest.id", null],
    ["user.id", null],
  );
}

test("logged out viewer", async () => {
  await confirmNoViewer();
});

test("log guest in", async () => {
  const [_, guests] = await createAndInvitePlusGuests(0);
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
      function (token: string) {
        jwtToken = token;
      },
    ],
  );

  let headers: Data = {};
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
      nullQueryPaths: ["user"],
    },
    ["guest.id", encodeGQLID(guest)],
    ["guest.emailAddress", guest.emailAddress],
    ["user.id", null],
  );
});

test("incorrect guest credentials", async () => {
  const [_, guests] = await createAndInvitePlusGuests(0);
  const guest = guests[0];

  const code = await AuthCode.loadFromGuestIDX(guest.viewer, guest.id);

  expect(code.emailAddress).toBe(guest.emailAddress);
  expect(code.guestID).toBe(guest.id);

  let st = await expectMutation(
    {
      mutation: "authGuest",
      schema,
      args: {
        emailAddress: code.emailAddress,
        code: code.code + "1",
      },
      expectedError: "invalid login credentials",
    },
    ["viewer.guest.id", null],
  );

  await confirmNoViewer(st);
});

test("log user in", async () => {
  const user = await createUser();

  let jwtToken: string = "";
  let st: supertest.SuperTest<supertest.Test>;

  st = await expectMutation(
    {
      mutation: "authUser",
      schema,
      args: {
        emailAddress: user.emailAddress,
        password: "pa$$w0rd",
      },
      init: PassportStrategyHandler.testInitJWTFunction({
        secretOrKey: "secret",
        loaderOptions: User.loaderOptions(),
        authOptions: {
          session: false,
        },
      }),
    },
    // user is returned as viewer
    ["viewer.user.id", encodeGQLID(user)],
    [
      "token",
      function (token: string) {
        jwtToken = token;
      },
    ],
  );

  let headers: Data = {};
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
      nullQueryPaths: ["guest"],
    },
    ["user.id", encodeGQLID(user)],
    ["user.emailAddress", user.emailAddress],
    ["guest.id", null],
  );
});

test("incorrect user credentials", async () => {
  const user = await createUser();

  let st = await expectMutation(
    {
      mutation: "authUser",
      schema,
      args: {
        emailAddress: user.emailAddress,
        password: "123423",
      },
      expectedError: "invalid login credentials",
    },
    ["viewer.user.id", null],
  );

  await confirmNoViewer(st);
});
