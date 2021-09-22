import { LoggedOutViewer, IDViewer, DB, Viewer } from "@snowtop/ent";
import { clearAuthHandlers } from "@snowtop/ent/auth";
import { encodeGQLID } from "@snowtop/ent/graphql";
import {
  expectQueryFromRoot,
  queryRootConfig,
} from "@snowtop/ent-graphql-tests";
import schema from "../generated/schema";
import CreateUserAction from "../../ent/user/actions/create_user_action";
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
