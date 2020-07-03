import schema from "src/graphql/schema";
import DB from "ent/db";
import CreateUserAction from "src/ent/user/actions/create_user_action";
import { LoggedOutViewer } from "ent/viewer";
import { randomEmail } from "src/util/random";
import { IDViewer } from "src/util/id_viewer";
import { expectQueryFromRoot, queryRootConfig } from "src/graphql_test_utils";
import { Viewer } from "ent/ent";
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
  viewer?: Viewer,
  partialConfig?: Partial<queryRootConfig>,
): queryRootConfig {
  return {
    viewer: viewer,
    schema: schema,
    root: "viewer",
    args: {},
    ...partialConfig,
  };
}

test("logged out viewer", async () => {
  await expectQueryFromRoot(getConfig(), ["viewerID", null]);
});

test("viewer", async () => {
  let user = await CreateUserAction.create(loggedOutViewer, {
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: randomEmail(),
  }).saveX();
  let vc = new IDViewer(user.id);
  await expectQueryFromRoot(getConfig(vc), ["viewerID", user.id]);
});
