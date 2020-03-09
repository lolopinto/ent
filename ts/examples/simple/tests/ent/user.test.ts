import User, {
  createUser,
  editUser,
  deleteUser,
  UserCreateInput,
} from "../../src/ent/user";
import { LogedOutViewer } from "ent/viewer";

import DB from "ent/db";
import { v4 as uuidv4 } from "uuid";

const loggedOutViewer = new LogedOutViewer();

// TODO we need something that does this by default for all tests
afterAll(async () => {
  await DB.getInstance().endPool();
});

async function create(input: UserCreateInput): Promise<User> {
  let user = await createUser(loggedOutViewer, input);
  if (user == null) {
    fail("could not create user");
  }
  return user;
}

test("create user", async () => {
  try {
    let user = await create({ firstName: "Jon", lastName: "Snow" });

    expect(user.firstName).toBe("Jon");
    expect(user.lastName).toBe("Snow");
  } catch (e) {
    fail(e.message);
  }
});

test("edit user", async () => {
  try {
    let user = await create({ firstName: "Jon", lastName: "Snow" });

    let editedUser = await editUser(loggedOutViewer, user.id, {
      firstName: "First of his name",
    });

    expect(editedUser).not.toBe(null);
    expect(editedUser?.firstName).toBe("First of his name");
    expect(editedUser?.lastName).toBe("Snow");
  } catch (e) {
    fail(e.message);
  }
});

test("delete user", async () => {
  try {
    let user = await create({ firstName: "Jon", lastName: "Snow" });

    await deleteUser(loggedOutViewer, user.id);

    let loadedUser = await User.load(loggedOutViewer, user.id);
    expect(loadedUser).toBe(null);
  } catch (e) {
    fail(e.message);
  }
});

test("loadX", async () => {
  try {
    await User.loadX(loggedOutViewer, uuidv4());
    fail("should have thrown exception");
  } catch (e) {}
});
