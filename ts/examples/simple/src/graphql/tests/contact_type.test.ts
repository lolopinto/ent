import schema from "src/graphql/schema";
import CreateUserAction from "src/ent/user/actions/create_user_action";
import { DB, LoggedOutViewer, IDViewer, ID, Viewer } from "@lolopinto/ent";
import { Contact, User } from "src/ent/";
import { randomEmail, randomPhoneNumber } from "src/util/random";
import {
  expectQueryFromRoot,
  queryRootConfig,
} from "@lolopinto/ent-graphql-tests";
import { clearAuthHandlers } from "@lolopinto/ent/auth";

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
  contactID: ID,
  partialConfig?: Partial<queryRootConfig>,
): queryRootConfig {
  return {
    viewer: viewer,
    schema: schema,
    root: "contact",
    args: {
      id: contactID,
    },
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
  let userID = contact.userID;

  await expectQueryFromRoot(
    getConfig(new IDViewer(userID), contact.id),
    ["id", contact.id],
    ["user.id", userID],
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
    getConfig(new IDViewer(user.id), contact.id, { rootQueryNull: true }),
    ["id", null],
  );
});
