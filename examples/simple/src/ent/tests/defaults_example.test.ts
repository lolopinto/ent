import { DefaultsExample, User } from "..";
import CreateDefaultsExampleAction from "../defaults_example/actions/create_defaults_example_action";
import CreateUserAction, {
  UserCreateInput,
} from "../user/actions/create_user_action";
import { ExampleViewer, LoggedOutExampleViewer } from "../../viewer/viewer";
import { randomEmail, randomPhoneNumber } from "../../util/random";

const loggedOutViewer = new LoggedOutExampleViewer();

async function createViewerUser(
  overrides: Partial<UserCreateInput> = {},
): Promise<User> {
  const input: UserCreateInput = {
    firstName: "First",
    lastName: "Last",
    emailAddress: randomEmail(),
    password: "pa$$w0rd",
    phoneNumber: randomPhoneNumber(),
    ...overrides,
  };

  return CreateUserAction.create(loggedOutViewer, input).saveX();
}

test("create defaults example relies on generated defaults", async () => {
  const viewerUser = await createViewerUser();
  const viewer = new ExampleViewer(viewerUser.id);

  const defaultsExample = await CreateDefaultsExampleAction.create(viewer, {
    name: "with defaults",
  }).saveX();

  expect(defaultsExample.name).toBe("with defaults");
  expect(defaultsExample.creatorId).toBe(viewerUser.id);
  expect(defaultsExample.perHour).toBe(1);
  expect(defaultsExample.hourlyLimit).toBe(5);

  const loaded = await DefaultsExample.loadX(viewer, defaultsExample.id);
  expect(loaded.creatorId).toBe(viewerUser.id);
  expect(loaded.perHour).toBe(1);
  expect(loaded.hourlyLimit).toBe(5);
});
