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
import CreateContactAction from "src/ent/contact/actions/create_contact_action";
import { clearAuthHandlers } from "ent/auth";

// TODO we need something that does this by default for all tests
afterAll(async () => {
  await DB.getInstance().endPool();
});

afterEach(() => {
  clearAuthHandlers();
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

test("query custom field", async () => {
  let user = await create({
    firstName: "first",
    lastName: "last",
    emailAddress: randomEmail(),
  });

  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), user.id),
    ["id", user.id],
    ["firstName", user.firstName],
    ["lastName", user.lastName],
    ["fullName", user.fullName],
  );
});

test("query custom function", async () => {
  let [user, user2] = await Promise.all([
    create({
      firstName: "first",
      lastName: "last",
      emailAddress: randomEmail(),
    }),
    create({
      firstName: "first2",
      lastName: "last",
      emailAddress: randomEmail(),
    }),
  ]);
  let vc = new IDViewer(user.id);
  let action = EditUserAction.create(vc, user, {});
  action.builder.addFriend(user2);
  await action.saveX();

  const edges = await user.loadFriendsEdges();
  expect(edges.length).toBe(1);

  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), user.id),
    ["id", user.id],
    ["firstName", user.firstName],
    ["lastName", user.lastName],
    // returns id when logged in user is same
    ["bar", user.id],
  );
  clearAuthHandlers();

  // got some reason, it thinks this person is logged out
  await expectQueryFromRoot(
    getConfig(new IDViewer(user2.id), user.id),
    ["id", user.id],
    ["firstName", user.firstName],
    ["lastName", user.lastName],
    // returns null when viewed as different user
    ["bar", null],
  );
});

test("query custom async function", async () => {
  let user = await create({
    firstName: "first",
    lastName: "last",
    emailAddress: randomEmail(),
  });
  let vc = new IDViewer(user.id);
  await CreateContactAction.create(vc, {
    emailAddress: randomEmail("foo.com"),
    firstName: "Jon",
    lastName: "Snow",
    userID: user.id,
  }).saveX();

  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), user.id),
    ["id", user.id],
    ["contactSameDomain.id", null], // no contact on same domain
  );

  let contact = await CreateContactAction.create(vc, {
    emailAddress: randomEmail(),
    firstName: "Jon",
    lastName: "Snow",
    userID: user.id,
  }).saveX();

  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), user.id),
    ["id", user.id],
    ["contactSameDomain.id", contact.id], // query again, new contact shows up
  );
});

test("query custom async function list", async () => {
  let user = await create({
    firstName: "first",
    lastName: "last",
    emailAddress: randomEmail(),
  });
  let vc = new IDViewer(user.id);
  user = await User.loadX(vc, user.id);
  let selfContact = await user.loadSelfContact();
  let contact = await CreateContactAction.create(vc, {
    emailAddress: randomEmail(),
    firstName: "Jon",
    lastName: "Snow",
    userID: user.id,
  }).saveX();

  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), user.id),
    ["id", user.id],
    ["contactsSameDomain[0].id", selfContact!.id],
    ["contactsSameDomain[1].id", contact!.id],
  );
});

test("query custom async function nullable list", async () => {
  let user = await create({
    firstName: "first",
    lastName: "last",
    emailAddress: randomEmail(),
  });

  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), user.id, {
      nullQueryPaths: ["contactsSameDomainNullable"],
    }),
    ["id", user.id],
    ["contactsSameDomainNullable[0].id", null],
  );
});

test("query custom async function nullable contents", async () => {
  let user = await create({
    firstName: "first",
    lastName: "last",
    emailAddress: randomEmail(),
  });
  let vc = new IDViewer(user.id);
  user = await User.loadX(vc, user.id);
  let selfContact = await user.loadSelfContact();
  await CreateContactAction.create(vc, {
    emailAddress: randomEmail("foo.com"),
    firstName: "Jon",
    lastName: "Snow",
    userID: user.id,
  }).saveX();

  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), user.id),
    ["id", user.id],
    ["contactsSameDomainNullableContents[0].id", selfContact!.id],
    ["contactsSameDomainNullableContents[1].id", null],
  );
});

test("query custom async function nullable list contents", async () => {
  let user = await create({
    firstName: "first",
    lastName: "last",
    emailAddress: randomEmail(),
  });
  let vc = new IDViewer(user.id);
  user = await User.loadX(vc, user.id);
  let selfContact = await user.loadSelfContact();
  let contact = await CreateContactAction.create(vc, {
    emailAddress: randomEmail("foo.com"),
    firstName: "Jon",
    lastName: "Snow",
    userID: user.id,
  }).saveX();

  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), user.id),
    ["id", user.id],
    ["contactsSameDomainNullableContents[0].id", selfContact!.id],
    ["contactsSameDomainNullableContents[1].id", null],
  );
});

test("query custom async function nullable list and contents", async () => {
  let user = await create({
    firstName: "first",
    lastName: "last",
    emailAddress: randomEmail(),
  });
  let vc = new IDViewer(user.id);
  user = await User.loadX(vc, user.id);

  // not testing the null list case because it's hard

  // for user 2, because there's a valid email, we get a non-null list even though
  // the list is nullable
  let user2 = await create({
    firstName: "first",
    lastName: "last",
    emailAddress: randomEmail(),
  });
  let vc2 = new IDViewer(user2.id);
  user2 = await User.loadX(vc2, user2.id);
  let selfContact2 = await user2.loadSelfContact();
  await CreateContactAction.create(vc, {
    emailAddress: randomEmail("foo.com"),
    firstName: "Jon",
    lastName: "Snow",
    userID: user2.id,
  }).saveX();
  await expectQueryFromRoot(
    getConfig(new IDViewer(user2.id), user2.id),
    ["id", user2.id],
    ["contactsSameDomainNullableContentsAndList[0].id", selfContact2!.id],
    // can query this way because of id above
    ["contactsSameDomainNullableContentsAndList[1]", null],
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
