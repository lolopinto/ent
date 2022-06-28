import { advanceBy } from "jest-date-mock";
import { LoggedOutViewer, IDViewer, Viewer } from "@snowtop/ent";
import {
  expectQueryFromRoot,
  queryRootConfig,
} from "@snowtop/ent-graphql-tests";
import { clearAuthHandlers } from "@snowtop/ent/auth";
import { encodeGQLID } from "@snowtop/ent/graphql";
import schema from "../generated/schema";
import CreateUserAction from "../../ent/user/actions/create_user_action";
import { Contact, User } from "../../ent";
import { randomEmail, randomPhoneNumber } from "../../util/random";
import EditUserAction from "src/ent/user/actions/edit_user_action";
import CreateContactAction from "src/ent/contact/actions/create_contact_action";

afterEach(() => {
  clearAuthHandlers();
});

const loggedOutViewer = new LoggedOutViewer();

function getConfig(
  viewer: Viewer,
  contact: Contact,
  partialConfig?: Partial<queryRootConfig>,
): queryRootConfig {
  return {
    viewer: viewer,
    schema: schema,
    root: "node",
    args: {
      id: encodeGQLID(contact),
    },
    inlineFragmentRoot: "Contact",
    ...partialConfig,
  };
}

function getUserConfig(
  viewer: Viewer,
  contact: User,
  partialConfig?: Partial<queryRootConfig>,
): queryRootConfig {
  return {
    viewer: viewer,
    schema: schema,
    root: "node",
    args: {
      id: encodeGQLID(contact),
    },
    inlineFragmentRoot: "User",
    ...partialConfig,
  };
}

async function createUser(): Promise<User> {
  return await CreateUserAction.create(loggedOutViewer, {
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: randomEmail(),
    phoneNumber: randomPhoneNumber(),
    password: "pa$$w0rd",
  }).saveX();
}
async function createContact(user?: User): Promise<Contact> {
  if (!user) {
    user = await createUser();
  }
  const contact = await CreateContactAction.create(new IDViewer(user.id), {
    emails: [
      {
        emailAddress: randomEmail(),
        label: "default",
      },
    ],
    firstName: "Jon",
    lastName: "Snow",
    userID: user.id,
  }).saveX();
  // reload
  return await Contact.loadX(contact.viewer, contact.id);
}

test("query contact", async () => {
  let contact = await createContact();
  let user = await contact.loadUserX();
  let emails = await contact.loadEmails();

  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), contact),
    ["id", encodeGQLID(contact)],
    ["user.id", encodeGQLID(user)],
    ["user.firstName", contact.firstName],
    ["firstName", contact.firstName],
    ["lastName", contact.lastName],
    ["emails[0].emailAddress", emails[0].emailAddress],
  );
});

test("query contact with different viewer", async () => {
  let contact = await createContact();
  let user = await CreateUserAction.create(loggedOutViewer, {
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: randomEmail(),
    phoneNumber: randomPhoneNumber(),
    password: "pa$$w0rd",
  }).saveX();

  // can't load someone else's contact
  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), contact, { rootQueryNull: true }),
    ["id", null],
  );
});

test("likes", async () => {
  const user = await createUser();
  const [contact1, contact2, contact3] = await Promise.all([
    createContact(user),
    createContact(user),
    createContact(user),
  ]);
  const action = EditUserAction.create(user.viewer, user, {});
  for (const contact of [contact1, contact2, contact3]) {
    advanceBy(1000);
    action.builder.addLikeID(contact.id, contact.nodeType, {
      time: new Date(),
    });
  }
  // for privacy
  await action.saveX();

  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), contact1),
    ["likers.rawCount", 1],
    [
      "likers.nodes",
      [
        {
          id: encodeGQLID(user),
        },
      ],
    ],
  );

  await expectQueryFromRoot(
    getUserConfig(new IDViewer(user.id), user),
    ["likes.rawCount", 3],
    // most recent first
    [
      "likes.nodes",
      [
        {
          id: encodeGQLID(contact3),
        },
        {
          id: encodeGQLID(contact2),
        },
        {
          id: encodeGQLID(contact1),
        },
      ],
    ],
  );
});
