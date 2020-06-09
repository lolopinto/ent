import schema from "src/graphql/schema";
import DB from "ent/db";
import CreateUserAction from "src/ent/user/actions/create_user_action";
import { LoggedOutViewer } from "ent/viewer";
import Contact from "src/ent/contact";
import { randomEmail } from "src/util/random";
import { IDViewer } from "src/util/id_viewer";
import { expectQueryFromRoot, queryRootConfig } from "src/graphql_test_utils";
import { ID, Viewer } from "ent/ent";
import User from "src/ent/user";
import { clearAuthHandlers } from "ent/auth";

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
  }).saveX();

  // can't load someone else's contact
  await expectQueryFromRoot(
    getConfig(new IDViewer(user.id), contact.id, { rootQueryNull: true }),
    ["id", null],
  );
});
