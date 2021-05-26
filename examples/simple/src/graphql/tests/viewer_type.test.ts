import schema from "src/graphql/schema";
import CreateUserAction from "src/ent/user/actions/create_user_action";
import { LoggedOutViewer, IDViewer, DB, Viewer } from "@lolopinto/ent";
import { randomEmail, randomPhoneNumber } from "src/util/random";
import {
  expectQueryFromRoot,
  queryRootConfig,
} from "@lolopinto/ent-graphql-tests";
import { clearAuthHandlers } from "@lolopinto/ent/auth";
import { encodeGQLID } from "@lolopinto/ent/graphql";

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
    phoneNumber: randomPhoneNumber(),
    password: "pa$$w0rd",
  }).saveX();
  let vc = new IDViewer(user.id);
  await expectQueryFromRoot(
    getConfig(vc),
    ["viewerID", encodeGQLID(user)],
    ["user.id", encodeGQLID(user)],
    ["user.firstName", user.firstName],
  );
});
