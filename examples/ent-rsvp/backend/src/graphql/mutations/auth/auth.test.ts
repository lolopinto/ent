import { Data } from "@snowtop/ent";
import {
  expectMutation,
  expectQueryFromRoot,
  Option,
} from "@snowtop/ent-graphql-tests";
import { createUser, createAndInvitePlusGuests } from "src/testutils";
import schema from "src/graphql/generated/schema";
import { AuthCode } from "src/ent/auth_code";
import { encodeGQLID } from "@snowtop/ent/graphql";
import { PassportStrategyHandler } from "@snowtop/ent-passport";
import supertest from "supertest";
import { Guest, User } from "src/ent";
import each from "jest-each";

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

each([[true], [false]]).test("log guest in. any: %s", async (any: boolean) => {
  const [_, guests] = await createAndInvitePlusGuests(0);
  const guest = guests[0];

  const code = await AuthCode.loadFromGuestIdX(guest.viewer, guest.id);

  expect(code.emailAddress).toBe(guest.emailAddress);
  expect(code.guestId).toBe(guest.id);

  let jwtToken: string = "";
  let st: supertest.SuperTest<supertest.Test>;

  let mutation = "authGuest";
  let args: Data = {
    emailAddress: code.emailAddress,
    code: code.code,
  };
  let tests: Option[] = [
    // guest is returned as viewer
    ["viewer.guest.id", encodeGQLID(guest)],
    [
      "token",
      function (token: string) {
        jwtToken = token;
      },
    ],
  ];
  if (any) {
    mutation = "authAny";
    args = {
      guest: args,
    };
    tests = tests.map((t) => {
      t[0] = `guest.${t[0]}`;
      return t;
    });
  }
  st = await expectMutation(
    {
      mutation,
      schema,
      args,
      init: PassportStrategyHandler.testInitJWTFunction({
        secretOrKey: "secret",
        loaderOptions: Guest.loaderOptions(),
        authOptions: {
          session: false,
        },
      }),
    },
    ...tests,
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

  const code = await AuthCode.loadFromGuestIdX(guest.viewer, guest.id);

  expect(code.emailAddress).toBe(guest.emailAddress);
  expect(code.guestId).toBe(guest.id);

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

each([[true], [false]]).test("log user in. any: %s", async (any: boolean) => {
  const user = await createUser();

  let jwtToken: string = "";
  let st: supertest.SuperTest<supertest.Test>;

  let mutation = "authUser";
  let args: Data = {
    emailAddress: user.emailAddress,
    password: "pa$$w0rd",
  };
  let tests: Option[] = [
    // user is returned as viewer
    ["viewer.user.id", encodeGQLID(user)],
    [
      "token",
      function (token: string) {
        jwtToken = token;
      },
    ],
  ];
  if (any) {
    mutation = "authAny";
    args = {
      user: args,
    };
    tests = tests.map((t) => {
      t[0] = `user.${t[0]}`;
      return t;
    });
  }
  st = await expectMutation(
    {
      mutation,
      schema,
      args,
      init: PassportStrategyHandler.testInitJWTFunction({
        secretOrKey: "secret",
        loaderOptions: User.loaderOptions(),
        authOptions: {
          session: false,
        },
      }),
    },
    ...tests,
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
