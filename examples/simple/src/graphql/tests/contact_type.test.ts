import { DB, LoggedOutViewer, IDViewer, ID, Viewer } from "@snowtop/ent";
import {
  expectQueryFromRoot,
  queryRootConfig,
} from "@snowtop/ent-graphql-tests";
import { clearAuthHandlers } from "@snowtop/ent/auth";
import { encodeGQLID } from "@snowtop/ent/graphql";
import schema from "../schema";
import CreateUserAction from "../../ent/user/actions/create_user_action";
import { Contact, User } from "../../ent";
import { randomEmail, randomPhoneNumber } from "../../util/random";

// TODO we need something that does this by default for all tests
afterAll(async () => {
  await DB.getInstance().endPool();
});
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

async function createContact(): Promise<Contact> {
  let user = await CreateUserAction.create(loggedOutViewer, {
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: randomEmail(),
    phoneNumber: randomPhoneNumber(),
    password: "pa$$w0rd",
  }).saveX();
  let vc = new IDViewer(user.id);
  user = await User.loadX(vc, user.id);
  let contact = await user.loadSelfContact();
  if (!contact) {
    fail("couldn't load self contact");
  }
  return contact;
}

test("query contact", async () => {
  let contact = await createContact();
  let user = await contact.loadUserX();

  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), contact),
    ["id", encodeGQLID(contact)],
    ["user.id", encodeGQLID(user)],
    ["user.firstName", contact.firstName],
    ["firstName", contact.firstName],
    ["lastName", contact.lastName],
    ["emailAddress", contact.emailAddress],
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
