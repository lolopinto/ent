import schema from "src/graphql/schema";
import express from "express";
import graphqlHTTP from "express-graphql";
import { Viewer } from "ent/ent";
import request from "supertest";
import DB from "ent/db";
import CreateUserAction, {
  UserCreateInput,
} from "src/ent/user/actions/create_user_action";
import { LoggedOutViewer } from "ent/viewer";
import User from "src/ent/user";
import { randomEmail } from "src/util/random";
import { IDViewer } from "src/util/id_viewer";

// TODO come back and make test things here generic

function server(viewer: Viewer) {
  let app = express();
  app.use(
    "/graphql",
    graphqlHTTP({
      schema: schema,
      context: {
        viewer,
      },
    }),
  );
  return app;
}

function makeRequest(viewer: Viewer, str: string, args?: {}): request.Test {
  console.log(args);
  // query/variables etc
  return request(server(viewer))
    .post("/graphql")
    .send({
      query: str,
      variables: JSON.stringify(args),
    });
}

// TODO we need something that does this by default for all tests
afterAll(async () => {
  await DB.getInstance().endPool();
});

const loggedOutViewer = new LoggedOutViewer();

async function create(input: UserCreateInput): Promise<User> {
  return await CreateUserAction.create(loggedOutViewer, input).saveX();
}

type Option = [string, any];
// interface Option {
//   path: string;
//   value: any;
// }

function buildTreeFromQueryPaths(...options: Option[]) {
  let topLevelTree = {};
  options.forEach((option) => {
    let path = option[0];
    let parts = path.split(".");

    let tree = topLevelTree;
    parts.forEach((part) => {
      // if this part of the tree doesn't exist, put an empty node there
      if (tree[part] === undefined) {
        tree[part] = {};
      }
      tree = tree[part];
    });
  });
  return topLevelTree;
}

function constructQueryFromTreePath(treePath: {}) {
  let query: string[] = [];
  for (let key in treePath) {
    let value = treePath[key];
    let valueStr = constructQueryFromTreePath(value);
    if (!valueStr) {
      query.push(key);
    } else {
      query.push(`${key}{${valueStr}}`);
    }
  }
  return query.join(",");
}

function expectQueryResult(...options: Option[]) {
  let topLevelTree = buildTreeFromQueryPaths(...options);
  console.log(topLevelTree);

  let query = constructQueryFromTreePath(topLevelTree);

  console.log(query);
  return query;
}

function expectQueryFromRoot(root: string, args: {}, ...options: Option[]) {
  let params: string[] = [];
  for (let key in args) {
    params.push(`${key}: $${key}`);
  }
  let rootOption: Option = [`${root}(${params.join(",")})`, "ignore"];
  // don't need this and move the construction from what we're currently doing in test.only
  for (let i = 0; i < options.length; i++) {
    let option = options[i];
    option[0] = `${rootOption[0]}.${option[0]}`;
    options[i] = option;
  }

  options.unshift(rootOption);

  return expectQueryResult(...options);
}

test.only("tree building", async () => {
  // expectQueryResult(
  //   { path: "viewer.bar.baz", value: "1" },
  //   { path: "viewer.foo.baz", value: "2" },
  //   { path: "user(id:<id>).id", value: "id" },
  // );

  let user = await create({
    firstName: "ffirst",
    lastName: "last",
    emailAddress: randomEmail(),
  });

  let q = expectQueryFromRoot(
    "user",
    {
      id: user.id,
    },
    ["id", user.id],
    ["firstName", user.firstName],
    ["lastName", user.lastName],
  );
  //  schema.
  // wrap in query
  // TODO name of query
  // args of query TBD
  q = `query userQuery ($id: ID!){${q}}`;
  //  console.log(q);

  let res = await makeRequest(new IDViewer(user.id), q, { id: user.id })
    //    .expect(200) // can't always do this because apparently
    // by default we return 500
    .expect("Content-Type", /json/);
  console.log(res.body);
});

//"user(id: <id>).id";
test("simple", async () => {
  let user = await create({
    firstName: "ffirst",
    lastName: "last",
    emailAddress: randomEmail(),
  });
  let q = `query{
  user(id: "${user.id}") {
    id
  }
}`;

  let res = await makeRequest(new IDViewer(user.id), q)
    .expect(200)
    .expect("Content-Type", /json/);

  //  console.log(res.body);

  // it's json and has been parsed
  expect(res.body).toStrictEqual({
    data: {
      user: {
        id: user.id,
      },
    },
  });
});
