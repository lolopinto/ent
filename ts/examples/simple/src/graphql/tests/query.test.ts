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
import EditUserAction from "src/ent/user/actions/edit_user_action";
import { advanceBy } from "jest-date-mock";

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

function makeRequest(viewer: Viewer, query: string, args?: {}): request.Test {
  //  console.log(args);
  // query/variables etc
  return request(server(viewer))
    .post("/graphql")
    .send({
      query: query,
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

function buildTreeFromQueryPaths(...options: Option[]) {
  let topLevelTree = {};
  options.forEach((option) => {
    let path = option[0];
    let parts = path.split(".");

    let tree = topLevelTree;
    parts.forEach((part) => {
      // a list, remove the index in the list building part
      let idx = part.indexOf("[");
      if (idx !== -1) {
        part = part.substr(0, idx);
      }
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
      // leaf node
      query.push(key);
    } else {
      query.push(`${key}{${valueStr}}`);
    }
  }
  return query.join(",");
}

function expectQueryResult(...options: Option[]) {
  let topLevelTree = buildTreeFromQueryPaths(...options);
  //  console.log(topLevelTree);

  let query = constructQueryFromTreePath(topLevelTree);

  //  console.log(query);
  return query;
}

async function expectQueryFromRoot(
  viewer: Viewer,
  root: string,
  args: {},
  ...options: Option[] // TODO queries? expected values
) {
  // we want options after so this should not be variable sadly
  // or have this be overloaded
  let query = schema.getQueryType();
  let fields = query?.getFields();
  if (!fields) {
    fail("schema doesn't have query or fields");
  }
  let field = fields[root];
  if (!field) {
    fail(`could not find field ${root} in GraphQL query schema`);
  }
  let fieldArgs = field.args;

  let queryParams: string[] = [];
  fieldArgs.forEach((fieldArg) => {
    let arg = args[fieldArg.name];
    // let the graphql runtime handle this (it may be optional for example)
    if (!arg) {
      return;
    }
    queryParams.push(`$${fieldArg.name}: ${fieldArg.type}`);
  });
  let params: string[] = [];
  for (let key in args) {
    params.push(`${key}: $${key}`);
  }
  let q = expectQueryResult(...options);
  q = `query ${root}Query (${queryParams.join(",")}) {
    ${root}(${params.join(",")}) {${q}}
  }`;

  let res = await makeRequest(viewer, q, args).expect("Content-Type", /json/);
  if (res.status !== 200) {
    // TODO allow errors...
    throw new Error(
      `expected 200 status. instead got ${
        res.status
      } and result ${JSON.stringify(res.body)}`,
    );
  }

  let data = res.body.data;
  let result = data[root];

  //  console.log(result);
  options.forEach((option) => {
    let path = option[0];
    let expected = option[1];

    let parts = path.split(".");
    let current = result;

    if (expected === null) {
      // TODO this works for now but doesn't work when root node is visible and
      // and it's just a leaf that's not
      // we need a new way to indicate roof isn't
      expect(result).toBe(null);
      return;
    }
    //    console.log(result, current);
    // possible to make this smarter and better
    // e.g. when building up the tree above
    for (let i = 0; i < parts.length; i++) {
      let part = parts[i];
      let idx = part.indexOf("[");
      let listIdx: number | undefined;

      // list
      if (idx !== -1) {
        let endIdx = part.indexOf("]");
        if (endIdx === -1) {
          fail("can't have a beginning index without an end index");
        }
        // get the idx we care about
        listIdx = parseInt(part.substr(idx + 1, endIdx - idx), 10);
        //        console.log(idx, endIdx, part.substr(idx + 1, endIdx - idx), listIdx);

        // update part
        part = part.substr(0, idx);
        //        console.log(part, current, current[part]);
      }

      current = current[part];

      if (listIdx !== undefined) {
        current = current[listIdx];
      }

      if (i === parts.length - 1) {
        // leaf node, check the value
        expect(
          current,
          `value of ${part} in path ${path} was not as expected`,
        ).toBe(expected);
      } else {
        expect(
          part,
          `found undefined node in path ${path} at subtree ${part}`,
        ).not.toBe(undefined);
      }
    }
  });
}

test("query user", async () => {
  let user = await create({
    firstName: "ffirst",
    lastName: "last",
    emailAddress: randomEmail(),
  });

  await expectQueryFromRoot(
    new IDViewer(user.id),
    "user",
    {
      id: user.id,
    },
    ["id", user.id],
    ["firstName", user.firstName],
    ["lastName", user.lastName],
    ["emailAddress", user.emailAddress],
    ["accountStatus", user.accountStatus],
  );
});

test("query user who's not visible", async () => {
  let [user, user2] = await Promise.all([
    create({
      firstName: "user1",
      lastName: "last",
      emailAddress: randomEmail(),
    }),
    create({
      firstName: "user2",
      lastName: "last",
      emailAddress: randomEmail(),
    }),
  ]);

  // TODO this works for now but needs to change
  await expectQueryFromRoot(
    new IDViewer(user.id),
    "user",
    {
      id: user2.id,
    },
    ["id", null],
    ["firstName", null],
    ["lastName", null],
    ["emailAddress", null],
    ["accountStatus", null],
  );
});

test("query user and nested object", async () => {
  let user = await create({
    firstName: "ffirst",
    lastName: "last",
    emailAddress: randomEmail(),
  });
  let vc = new IDViewer(user.id);
  user = await User.loadX(vc, user.id);
  let selfContact = await user.loadSelfContact();
  if (!selfContact) {
    fail("expected self contact to be loaded");
  }

  await expectQueryFromRoot(
    new IDViewer(user.id),
    "user",
    {
      id: user.id,
    },
    ["id", user.id],
    ["firstName", user.firstName],
    ["lastName", user.lastName],
    ["emailAddress", user.emailAddress],
    ["accountStatus", user.accountStatus],
    ["selfContact.id", selfContact.id],
    ["selfContact.firstName", selfContact.firstName],
    ["selfContact.lastName", selfContact.lastName],
    ["selfContact.emailAddress", selfContact.emailAddress],
    // TODO we allow loading id objects here instead of invalidating them
    // e.g. userID is available here
    ["selfContact.user.id", user.id],
  );
});

test("load list", async () => {
  let [user, user2, user3] = await Promise.all([
    create({
      firstName: "user1",
      lastName: "last",
      emailAddress: randomEmail(),
    }),
    create({
      firstName: "user2",
      lastName: "last",
      emailAddress: randomEmail(),
    }),
    create({
      firstName: "user3",
      lastName: "last",
      emailAddress: randomEmail(),
    }),
  ]);

  let vc = new IDViewer(user.id);
  let action = EditUserAction.create(vc, user, {});
  action.builder.addFriend(user2);
  await action.saveX();

  // add time btw adding a new friend so that it's deterministic
  advanceBy(86400);
  let action2 = EditUserAction.create(vc, user, {});
  action2.builder.addFriend(user3);
  await action2.saveX();

  await expectQueryFromRoot(
    new IDViewer(user.id),
    "user",
    {
      id: user.id,
    },
    ["id", user.id],
    ["firstName", user.firstName],
    ["lastName", user.lastName],
    ["emailAddress", user.emailAddress],
    ["accountStatus", user.accountStatus],
    // most recent first
    ["friends[0].id", user3.id],
    ["friends[0].firstName", user3.firstName],
    ["friends[0].lastName", user3.lastName],
    ["friends[1].id", user2.id],
    ["friends[1].firstName", user2.firstName],
    ["friends[1].lastName", user2.lastName],
  );
});
