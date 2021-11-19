import { advanceBy } from "jest-date-mock";
import { DB, LoggedOutViewer, IDViewer, Viewer } from "@snowtop/ent";
import { clearAuthHandlers } from "@snowtop/ent/auth";
import { encodeGQLID, mustDecodeIDFromGQLID } from "@snowtop/ent/graphql";
import {
  queryRootConfig,
  expectQueryFromRoot,
  expectMutation,
} from "@snowtop/ent-graphql-tests";
import schema from "../generated/schema";
import CreateUserAction, {
  UserCreateInput,
} from "../../ent/user/actions/create_user_action";
import { Contact, User, DaysOff, PreferredShift } from "../../ent/";
import { randomEmail, randomPhoneNumber } from "../../util/random";
import EditUserAction from "../../ent/user/actions/edit_user_action";
import CreateContactAction, {
  ContactCreateInput,
} from "../../ent/contact/actions/create_contact_action";

// TODO we need something that does this by default for all tests
afterAll(async () => {
  await DB.getInstance().endPool();
});

afterEach(() => {
  clearAuthHandlers();
});

const loggedOutViewer = new LoggedOutViewer();

async function create(opts: Partial<UserCreateInput>): Promise<User> {
  let input: UserCreateInput = {
    firstName: "first",
    lastName: "last",
    emailAddress: randomEmail(),
    phoneNumber: randomPhoneNumber(),
    password: "pa$$w0rd",
    ...opts,
  };
  return await CreateUserAction.create(loggedOutViewer, input).saveX();
}

function getConfig(
  viewer: Viewer,
  user: User,
  partialConfig?: Partial<queryRootConfig>,
): queryRootConfig {
  return {
    viewer: viewer,
    schema: schema,
    root: "node",
    args: {
      id: encodeGQLID(user),
    },
    inlineFragmentRoot: "User",
    ...partialConfig,
  };
}

test("query user", async () => {
  let user = await create({
    firstName: "ffirst",
  });

  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), user),
    ["id", encodeGQLID(user)],
    ["firstName", user.firstName],
    ["lastName", user.lastName],
    ["emailAddress", user.emailAddress],
    ["accountStatus", user.accountStatus],
    ["nicknames", null],
  );
});

test("query custom field", async () => {
  let user = await create({
    firstName: "first",
  });

  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), user),
    ["id", encodeGQLID(user)],
    ["firstName", user.firstName],
    ["lastName", user.lastName],
    ["fullName", user.fullName],
    ["nicknames", null],
  );
});

test("query list", async () => {
  const n = ["Lord Snow", "The Prince That was Promised"];
  let user = await create({
    firstName: "first",
    nicknames: n,
  });

  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), user),
    ["id", encodeGQLID(user)],
    ["firstName", user.firstName],
    ["lastName", user.lastName],
    ["fullName", user.fullName],
    ["nicknames", n],
  );
});

test("query custom function", async () => {
  let [user, user2] = await Promise.all([
    create({
      firstName: "first",
    }),
    create({
      firstName: "first2",
    }),
  ]);
  let vc = new IDViewer(user.id);
  let action = EditUserAction.create(vc, user, {});
  action.builder.addFriend(user2);
  await action.saveX();

  const count = await user.queryFriends().queryCount();
  expect(count).toBe(1);

  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), user),
    ["id", encodeGQLID(user)],
    ["firstName", user.firstName],
    ["lastName", user.lastName],
    // returns id when logged in user is same
    ["bar", user.id],
    ["nicknames", null],
  );
  clearAuthHandlers();

  // got some reason, it thinks this person is logged out
  await expectQueryFromRoot(
    getConfig(new IDViewer(user2.id), user),
    ["id", encodeGQLID(user)],
    ["firstName", user.firstName],
    ["lastName", user.lastName],
    // returns null when viewed as different user
    ["bar", null],
    ["nicknames", null],
  );
});

test("query custom async function", async () => {
  let user = await create({
    firstName: "first",
  });
  let vc = new IDViewer(user.id);
  await CreateContactAction.create(vc, {
    emailAddress: randomEmail("foo.com"),
    firstName: "Jon",
    lastName: "Snow",
    userID: user.id,
  }).saveX();

  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), user, {
      nullQueryPaths: ["contactSameDomain"],
    }),
    ["id", encodeGQLID(user)],
    ["contactSameDomain.id", null], // no contact on same domain
  );

  let contact = await CreateContactAction.create(vc, {
    emailAddress: randomEmail(),
    firstName: "Jon",
    lastName: "Snow",
    userID: user.id,
  }).saveX();

  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), user),
    ["id", encodeGQLID(user)],
    ["contactSameDomain.id", encodeGQLID(contact)], // query again, new contact shows up
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
    getConfig(new IDViewer(user.id), user),
    ["id", encodeGQLID(user)],
    ["contactsSameDomain[0].id", encodeGQLID(contact!)],
    ["contactsSameDomain[1].id", encodeGQLID(selfContact!)],
  );
});

test("query custom async function nullable list", async () => {
  let user = await create({
    firstName: "first",
  });

  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), user, {
      nullQueryPaths: ["contactsSameDomainNullable"],
    }),
    ["id", encodeGQLID(user)],
    ["contactsSameDomainNullable[0].id", null],
  );
});

test("query custom async function nullable contents", async () => {
  let user = await create({
    firstName: "first",
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
    getConfig(new IDViewer(user.id), user),
    ["id", encodeGQLID(user)],
    [
      "contactsSameDomainNullableContents",
      [
        null,
        {
          id: encodeGQLID(selfContact!),
        },
      ],
    ],
  );
});

test("query custom async function nullable list contents", async () => {
  let user = await create({
    firstName: "first",
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
    getConfig(new IDViewer(user.id), user, {
      nullQueryPaths: ["contactsSameDomainNullableContents[0]"],
    }),
    ["id", encodeGQLID(user)],
    ["contactsSameDomainNullableContents[0].id", null],
    ["contactsSameDomainNullableContents[1].id", encodeGQLID(selfContact!)],
  );
});

test("query custom async function nullable list and contents", async () => {
  let user = await create({
    firstName: "first",
  });
  let vc = new IDViewer(user.id);
  user = await User.loadX(vc, user.id);

  // not testing the null list case because it's hard

  // for user 2, because there's a valid email, we get a non-null list even though
  // the list is nullable
  let user2 = await create({
    firstName: "first",
  });
  let vc2 = new IDViewer(user2.id);
  user2 = await User.loadX(vc2, user2.id);
  let selfContact2 = await user2.loadSelfContact();
  await CreateContactAction.create(vc2, {
    emailAddress: randomEmail("foo.com"),
    firstName: "Jon",
    lastName: "Snow",
    userID: user2.id,
  }).saveX();
  await expectQueryFromRoot(
    getConfig(vc2, user2),
    ["id", encodeGQLID(user2)],
    // can query this way because of id above
    ["contactsSameDomainNullableContentsAndList[0]", null],
    [
      "contactsSameDomainNullableContentsAndList[1].id",
      encodeGQLID(selfContact2!),
    ],
  );
});

test("query user who's not visible", async () => {
  let [user, user2] = await Promise.all([
    create({
      firstName: "user1",
    }),
    create({
      firstName: "user2",
    }),
  ]);

  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), user2, { rootQueryNull: true }),
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
  });
  let vc = new IDViewer(user.id);
  user = await User.loadX(vc, user.id);
  let selfContact = await user.loadSelfContact();
  if (!selfContact) {
    fail("expected self contact to be loaded");
  }

  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), user),
    ["id", encodeGQLID(user)],
    ["firstName", user.firstName],
    ["lastName", user.lastName],
    ["emailAddress", user.emailAddress],
    ["accountStatus", user.accountStatus],
    ["selfContact.id", encodeGQLID(selfContact)],
    ["selfContact.firstName", selfContact.firstName],
    ["selfContact.lastName", selfContact.lastName],
    ["selfContact.emailAddress", selfContact.emailAddress],
    ["selfContact.user.id", encodeGQLID(user)],
  );
});

test("load assoc connection", async () => {
  let [user, user2, user3, user4, user5] = await Promise.all([
    create({
      firstName: "user1",
    }),
    create({
      firstName: "user2",
    }),
    create({
      firstName: "user3",
    }),
    create({
      firstName: "user4",
    }),
    create({
      firstName: "user5",
    }),
  ]);

  let vc = new IDViewer(user.id);
  let action = EditUserAction.create(vc, user, {});
  const friends = [user2, user3, user4, user5];
  for (const friend of friends) {
    // add time btw adding a new friend so that it's deterministic
    advanceBy(86400);
    action.builder.addFriendID(friend.id, {
      time: new Date(),
    });
  }
  await action.saveX();

  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), user),
    ["id", encodeGQLID(user)],
    ["firstName", user.firstName],
    ["lastName", user.lastName],
    ["emailAddress", user.emailAddress],
    ["accountStatus", user.accountStatus],
    // most recent first
    ["friends.rawCount", 4],
    [
      "friends.nodes",
      [
        {
          id: encodeGQLID(user5),
          firstName: user5.firstName,
          lastName: user5.lastName,
        },
        {
          id: encodeGQLID(user4),
          firstName: user4.firstName,
          lastName: user4.lastName,
        },
        {
          id: encodeGQLID(user3),
          firstName: user3.firstName,
          lastName: user3.lastName,
        },
        {
          id: encodeGQLID(user2),
          firstName: user2.firstName,
          lastName: user2.lastName,
        },
      ],
    ],
    [
      "friends.edges",
      [
        {
          node: {
            id: encodeGQLID(user5),
          },
        },
        {
          node: {
            id: encodeGQLID(user4),
          },
        },
        {
          node: {
            id: encodeGQLID(user3),
          },
        },
        {
          node: {
            id: encodeGQLID(user2),
          },
        },
      ],
    ],
  );

  let cursor: string;
  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), user),
    ["id", encodeGQLID(user)],
    ["friends(first:1).edges[0].node.id", encodeGQLID(user5)],
    [
      "friends(first:1).edges[0].cursor",
      function (c: string) {
        cursor = c;
      },
    ],
    [`friends(first:1).pageInfo.hasNextPage`, true],
  );

  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), user),
    ["id", encodeGQLID(user)],
    [
      `friends(after: "${cursor!}", first:1).edges[0].node.id`,
      encodeGQLID(user4),
    ],
    [
      `friends(after: "${cursor!}", first:1).edges[0].cursor`,
      function (c: string) {
        cursor = c;
      },
    ],
    [`friends(after: "${cursor!}", first:1).pageInfo.hasNextPage`, true],
  );

  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), user),
    ["id", encodeGQLID(user)],
    [
      `friends(after: "${cursor!}", first:1).edges[0].node.id`,
      encodeGQLID(user3),
    ],
    [
      `friends(after: "${cursor!}", first:1).edges[0].cursor`,
      function (c: string) {
        cursor = c;
      },
    ],
    [`friends(after: "${cursor!}", first:1).pageInfo.hasNextPage`, true],
  );

  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), user),
    ["id", encodeGQLID(user)],
    [
      `friends(after: "${cursor!}", first:1).edges[0].node.id`,
      encodeGQLID(user2),
    ],
    [
      `friends(after: "${cursor!}", first:1).edges[0].cursor`,
      function (c: string) {
        cursor = c;
      },
    ],
    [`friends(after: "${cursor!}", first:1).pageInfo.hasNextPage`, false],
  );

  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), user, {
      undefinedQueryPaths: [`friends(after: "${cursor!}", first:1).edges[0]`],
    }),
    ["id", encodeGQLID(user)],
    [`friends(after: "${cursor!}", first:1).edges[0].node.id`, undefined],
    [`friends(after: "${cursor!}", first:1).pageInfo.hasNextPage`, false],
  );
});

async function createMany(
  user: User,
  names: Pick<ContactCreateInput, "firstName" | "lastName">[],
): Promise<Contact[]> {
  let results: Contact[] = [];
  for (const name of names) {
    // for deterministic sorting
    advanceBy(86400);
    // TODO eventually a multi-create API
    let contact = await CreateContactAction.create(new IDViewer(user.id), {
      emailAddress: randomEmail(),
      firstName: name.firstName,
      lastName: name.lastName,
      userID: user.id,
    }).saveX();
    results.push(contact);
  }

  return results;
}

test("load fkey connection", async () => {
  const user = await create({});
  let inputs = [
    { firstName: "Robb", lastName: "Stark" },
    { firstName: "Sansa", lastName: "Stark" },
    { firstName: "Arya", lastName: "Stark" },
    { firstName: "Bran", lastName: "Stark" },
    { firstName: "Rickon", lastName: "Stark" },
  ];
  const contacts = await createMany(user, inputs);
  const selfContact = await user.loadSelfContact();

  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), user),
    ["id", encodeGQLID(user)],
    ["firstName", user.firstName],
    ["lastName", user.lastName],
    ["emailAddress", user.emailAddress],
    ["accountStatus", user.accountStatus],
    ["contacts.rawCount", 6],
    [
      // most recent first
      "contacts.nodes",
      [
        {
          id: encodeGQLID(contacts[4]),
        },
        {
          id: encodeGQLID(contacts[3]),
        },
        {
          id: encodeGQLID(contacts[2]),
        },
        {
          id: encodeGQLID(contacts[1]),
        },
        {
          id: encodeGQLID(contacts[0]),
        },
        {
          id: encodeGQLID(selfContact!),
        },
      ],
    ],
  );
});

test("likes", async () => {
  const [user1, user2, user3, user4] = await Promise.all([
    create({}),
    create({}),
    create({}),
    create({}),
  ]);
  const action = EditUserAction.create(user1.viewer, user1, {});
  for (const liker of [user2.id, user3.id, user4.id]) {
    advanceBy(1000);
    action.builder.addLikerID(liker, {
      time: new Date(),
    });
  }
  // for privacy
  action.builder.addFriend(user2, user3, user4);
  await action.saveX();

  await expectQueryFromRoot(
    getConfig(new IDViewer(user1.id), user1),
    ["likers.rawCount", 3],
    [
      "likers.nodes",
      [
        // most recent first
        {
          id: encodeGQLID(user4),
        },
        {
          id: encodeGQLID(user3),
        },
        {
          id: encodeGQLID(user2),
        },
      ],
    ],
  );

  // query likes also
  for (const liker of [user2, user3, user4]) {
    await expectQueryFromRoot(
      getConfig(new IDViewer(liker.id), liker),
      ["likes.rawCount", 1],
      [
        "likes.nodes",
        [
          {
            id: encodeGQLID(user1),
          },
        ],
      ],
    );
  }
});

test("create with prefs", async () => {
  await expectMutation(
    {
      schema: schema,
      mutation: "userCreate",
      args: {
        firstName: "Jon",
        lastName: "Snow",
        emailAddress: randomEmail(),
        phoneNumber: randomPhoneNumber(),
        password: "pa$$w0rd",
        prefs: "12232",
      },
    },
    [
      "user.id",
      async function (id: string) {
        const entID = mustDecodeIDFromGQLID(id);
        const user = await User.loadX(new IDViewer(entID), entID);
        // so graphql doesn't verify what's happening here because we depend on TS types. hmm
        // TODO fix https://github.com/lolopinto/ent/issues/470
        expect(user.prefs).toBe(12232);
      },
    ],
  );
});

test("create with prefs diff", async () => {
  await expectMutation(
    {
      schema: schema,
      mutation: "userCreate",
      args: {
        firstName: "Jon",
        lastName: "Snow",
        emailAddress: randomEmail(),
        phoneNumber: randomPhoneNumber(),
        password: "pa$$w0rd",
        prefsDiff: {
          type: "blah",
          foo: "foo",
        },
      },
    },
    [
      "user.id",
      async function (id: string) {
        const entID = mustDecodeIDFromGQLID(id);
        const user = await User.loadX(new IDViewer(entID), entID);
        expect(user.prefsDiff).toStrictEqual({
          type: "blah",
          foo: "foo",
        });
      },
    ],
  );
});

test("create with prefs diff. fail", async () => {
  await expectMutation(
    {
      schema: schema,
      mutation: "userCreate",
      args: {
        firstName: "Jon",
        lastName: "Snow",
        emailAddress: randomEmail(),
        phoneNumber: randomPhoneNumber(),
        password: "pa$$w0rd",
        prefsDiff: {
          foo: "foo",
        },
      },
      expectedError: /invalid field prefs_diff with value/,
    },
    [
      "user.id",
      async function (id: string) {
        throw new Error("not called");
      },
    ],
  );
});

test("enum list", async () => {
  await expectMutation(
    {
      schema: schema,
      mutation: "userCreate",
      args: {
        firstName: "Jon",
        lastName: "Snow",
        emailAddress: randomEmail(),
        phoneNumber: randomPhoneNumber(),
        password: "pa$$w0rd",
        daysOff: ["SATURDAY", "SUNDAY"],
        preferredShift: ["GRAVEYARD"],
      },
    },
    // TODO need to be able to query this correctly
    //["user.daysOff", ["SATURDAY", "SUNDAY"]],
    [
      "user.id",
      async function (id: string) {
        const decoded = mustDecodeIDFromGQLID(id);
        const user = await User.loadX(new IDViewer(decoded), decoded);
        expect(user.daysOff).toEqual([DaysOff.Saturday, DaysOff.Sunday]);
        expect(user.preferredShift).toEqual([PreferredShift.Graveyard]);
      },
    ],
  );
});
