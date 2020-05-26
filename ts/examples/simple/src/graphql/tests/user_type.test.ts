import schema from "src/graphql/schema";
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
import { queryRootConfig, expectQueryFromRoot } from "src/graphql_test_utils";
import { ID, Viewer } from "ent/ent";

// TODO we need something that does this by default for all tests
afterAll(async () => {
  await DB.getInstance().endPool();
});

const loggedOutViewer = new LoggedOutViewer();

async function create(input: UserCreateInput): Promise<User> {
  return await CreateUserAction.create(loggedOutViewer, input).saveX();
}

function getConfig(
  viewer: Viewer,
  userID: ID,
  partialConfig?: Partial<queryRootConfig>,
): queryRootConfig {
  return {
    viewer: viewer,
    schema: schema,
    root: "user",
    args: {
      id: userID,
    },
    ...partialConfig,
  };
}

test("query user", async () => {
  let user = await create({
    firstName: "ffirst",
    lastName: "last",
    emailAddress: randomEmail(),
  });

  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), user.id),
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

  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), user2.id, { rootQueryNull: true }),
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
    getConfig(new IDViewer(user.id), user.id),
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
    getConfig(new IDViewer(user.id), user.id),
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
