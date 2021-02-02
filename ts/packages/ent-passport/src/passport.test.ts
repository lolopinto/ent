import {
  AlwaysAllowPrivacyPolicy,
  Data,
  ID,
  IDViewer,
  RequestContext,
  Viewer,
} from "@lolopinto/ent";
import {
  expectQueryFromRoot,
  expectMutation,
} from "@lolopinto/ent-graphql-tests";
import { clearAuthHandlers } from "@lolopinto/ent/auth";
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLNonNull,
  GraphQLID,
  GraphQLFieldConfig,
} from "graphql";
import { QueryRecorder } from "@lolopinto/ent/testutils/db_mock";
import { createRowForTest } from "@lolopinto/ent/testutils/write";
import { Pool } from "pg";
import { loadRow, query, Ent } from "@lolopinto/ent";
import { useAndVerifyAuth, useAndVerifyAuthJWT } from "./passport";
import { PassportStrategyHandler, PassportAuthHandler } from "./passport";
import { Express } from "express";
import supertest from "supertest";
import jwt from "jsonwebtoken";

jest.mock("pg");
QueryRecorder.mockPool(Pool);

afterEach(() => {
  clearAuthHandlers();
  QueryRecorder.clear();
});

let userType = new GraphQLObjectType({
  name: "User",
  fields: {
    id: {
      type: GraphQLNonNull(GraphQLID),
    },
    firstName: {
      type: GraphQLString,
    },
    lastName: {
      type: GraphQLString,
    },
    emailAddress: {
      type: GraphQLString,
    },
  },
});

class UserClass implements Ent {
  nodeType = "User";
  privacyPolicy = AlwaysAllowPrivacyPolicy;
  firstName: string;
  lastName: string;
  emailAddress: string;

  constructor(public viewer: Viewer, public id: ID, options: Data) {
    this.firstName = options.first_name;
    this.lastName = options.last_name;
    this.emailAddress = options.email_address;
  }

  static loaderOptions() {
    return {
      ent: UserClass,
      tableName: "users",
      fields: ["id", "first_name", "last_name", "email_address"],
    };
  }
}

let viewerType = new GraphQLObjectType({
  name: "Viewer",
  fields: {
    user: {
      type: userType,
      async resolve(_source, args, context) {
        const v = context.getViewer() as IDViewer;

        return await v.viewer();
      },
    },
  },
});

let authUserPayloadType = new GraphQLObjectType({
  name: "AuthUserPayload",
  fields: {
    token: {
      type: GraphQLNonNull(GraphQLString),
    },
    viewer: {
      type: GraphQLNonNull(viewerType),
    },
  },
});

const authUserType: GraphQLFieldConfig<undefined, RequestContext, { args }> = {
  args: {
    emailAddress: {
      type: GraphQLNonNull(GraphQLString),
    },
    password: {
      type: GraphQLNonNull(GraphQLString),
    },
  },
  type: GraphQLNonNull(authUserPayloadType),
  async resolve(_source, args, context) {
    const [viewer, token] = await useAndVerifyAuthJWT(
      context,
      async () => {
        const row = await loadRow({
          tableName: "users",
          clause: query.And(
            query.Eq("email_address", args["emailAddress"]),
            query.Eq("password", args["password"]),
          ),
          fields: ["id"],
        });
        return row?.id;
      },
      {
        secretOrKey: "secret",
      },
      UserClass.loaderOptions(),
      {
        session: false,
      },
    );
    return {
      viewer,
      token,
    };
  },
};

const authUserSessionType: GraphQLFieldConfig<
  undefined,
  RequestContext,
  { args }
> = {
  args: {
    emailAddress: {
      type: GraphQLNonNull(GraphQLString),
    },
    password: {
      type: GraphQLNonNull(GraphQLString),
    },
  },
  type: GraphQLNonNull(viewerType),
  async resolve(_source, args, context) {
    return await useAndVerifyAuth(
      context,
      async () => {
        const row = await loadRow({
          tableName: "users",
          clause: query.And(
            query.Eq("email_address", args["emailAddress"]),
            query.Eq("password", args["password"]),
          ),
          fields: ["id"],
        });
        return row?.id;
      },
      UserClass.loaderOptions(),
    );
  },
};

const viewerType2: GraphQLFieldConfig<undefined, RequestContext, { args }> = {
  args: {},
  type: viewerType,
  resolve(_source, args, context) {
    return context.getViewer();
  },
};

const mutationType = new GraphQLObjectType({
  name: "MutationType",
  fields: {
    authUser: authUserType,
    authUserSession: authUserSessionType,
  },
});

const queryType = new GraphQLObjectType({
  name: "QueryType",
  fields: {
    viewer: viewerType2,
  },
});

const schema = new GraphQLSchema({
  query: queryType,
  mutation: mutationType,
});

test("logged out", async () => {
  await expectQueryFromRoot(
    {
      root: "viewer",
      args: {},
      schema: schema,
      nullQueryPaths: ["user"],
    },
    ["user.id", null],
  );
});

interface User {
  id: string | number;
  firstName: string;
  lastName: string;
  emailAddress: string;
  password: string;
}

async function createUser(opts?: Partial<User>) {
  return await createRowForTest(
    {
      tableName: "users",
      fields: {
        id: "1",
        first_name: "Dany",
        last_name: "Targaryen",
        email_address: "dany@targaryen.com",
        password: "12345678",
        ...opts,
      },
    },
    "RETURNING *",
  );
}

describe("jwt", () => {
  test("logged in", async () => {
    const user = await createUser();

    let jwtToken: string = "";

    const st = await expectMutation(
      {
        mutation: "authUser",
        schema,
        disableInputWrapping: true,
        args: {
          emailAddress: "dany@targaryen.com",
          password: "12345678",
        },
        init: PassportStrategyHandler.testInitJWTFunction({
          secretOrKey: "secret",
          loaderOptions: UserClass.loaderOptions(),
        }),
      },
      ["viewer.user.id", "1"],
      [
        "token",
        function(token) {
          const decoded = jwt.decode(token);
          expect(decoded).not.toBe(null);
          expect(decoded!["viewerID"]).toBe(user?.id);

          jwtToken = token;
        },
      ],
    );

    let headers = {};
    if (jwtToken) {
      headers["Authorization"] = `Bearer ${jwtToken}`;
    }

    // user is logged in
    await expectQueryFromRoot(
      {
        root: "viewer",
        schema,
        args: {},
        test: st,
        headers: headers,
      },
      ["user.id", "1"],
      ["user.emailAddress", "dany@targaryen.com"],
    );

    // user still logged in without st since this is session-less
    await expectQueryFromRoot(
      {
        root: "viewer",
        schema,
        args: {},
        headers: headers,
      },
      ["user.id", "1"],
    );

    // no headers, user logged out
    await expectQueryFromRoot(
      {
        root: "viewer",
        schema,
        test: st,
        args: {},
        nullQueryPaths: ["user"],
      },
      ["user.id", null],
    );
  });

  test("invalid credentials", async () => {
    await expectMutation(
      {
        mutation: "authUser",
        schema,
        disableInputWrapping: true,
        args: {
          emailAddress: "dany@targaryen.com",
          password: "12345678",
        },
        init: PassportStrategyHandler.testInitJWTFunction({
          secretOrKey: "secret",
          loaderOptions: UserClass.loaderOptions(),
        }),
        expectedError: "invalid login credentials",
      },
      ["viewer.user.id", "1"],
    );
  });
});

describe("session based", () => {
  test("logged in", async () => {
    await createUser();

    const st = await expectMutation(
      {
        // pass a function that takes a server that keeps track of cookies etc
        // and use that for this request
        test: (app: Express) => {
          return supertest.agent(app);
        },
        mutation: "authUserSession",
        schema,
        disableInputWrapping: true,
        args: {
          emailAddress: "dany@targaryen.com",
          password: "12345678",
        },
        init: PassportAuthHandler.testInitSessionBasedFunction("secret", {
          loadOptions: UserClass.loaderOptions(),
        }),
      },
      ["user.id", "1"],
    );

    // resend with authed server
    // user is still logged in
    await expectQueryFromRoot(
      {
        root: "viewer",
        schema,
        args: {},
        test: st,
      },
      ["user.id", "1"],
      ["user.emailAddress", "dany@targaryen.com"],
    );

    // user logged out if not attached to server
    await expectQueryFromRoot(
      {
        root: "viewer",
        schema,
        args: {},
        nullQueryPaths: ["user"],
      },
      ["user.id", null],
    );
  });

  test("invalid credentials", async () => {
    await expectMutation(
      {
        mutation: "authUser",
        schema,
        disableInputWrapping: true,
        args: {
          emailAddress: "dany@targaryen.com",
          password: "12345678",
        },
        init: PassportAuthHandler.testInitSessionBasedFunction("secret"),
        expectedError: "invalid login credentials",
      },
      ["viewer.user.id", null],
    );
  });
});
