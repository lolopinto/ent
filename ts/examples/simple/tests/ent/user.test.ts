import User, {
  createUser,
  editUser,
  deleteUser,
  UserCreateInput,
} from "src/ent/user";

import { ID, Ent, Viewer } from "ent/ent";
import DB from "ent/db";
import { LogedOutViewer } from "ent/viewer";

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

class IDViewer implements Viewer {
  constructor(public viewerID: ID, private ent: Ent | null = null) {}
  async viewer() {
    return this.ent;
  }
  instanceKey(): string {
    return `idViewer: ${this.viewerID}`;
  }
}

describe("privacy", () => {
  test("load", async () => {
    let user = await create({ firstName: "Jon", lastName: "Snow" });
    let user2 = await create({
      firstName: "Daenerys",
      lastName: "Targaryen",
    });

    try {
      // we only do privacy checks when loading right now...
      let loadedUser = await User.load(new IDViewer(user.id, user), user.id);
      expect(loadedUser).not.toBe(null);
      expect(loadedUser?.id).toBe(user.id);

      // privacy indicates other user cannot load
      let loadedUser2 = await User.load(new IDViewer(user2.id, user2), user.id);
      expect(loadedUser2).toBe(null);
    } catch (e) {
      fail(e.message);
    }
  });

  test("loadX", async () => {
    let user = await create({ firstName: "Jon", lastName: "Snow" });
    let user2 = await create({
      firstName: "Daenerys",
      lastName: "Targaryen",
    });

    try {
      // we only do privacy checks when loading right now...
      let loadedUser = await User.loadX(new IDViewer(user.id, user), user.id);
      expect(loadedUser.id).toBe(user.id);
    } catch (e) {
      fail(e.message);
    }

    try {
      // privacy indicates other user cannot load
      await User.loadX(new IDViewer(user2.id, user2), user.id);
      fail("should have thrown exception");
    } catch (e) {}
  });
});

test("loadX", async () => {
  try {
    await User.loadX(loggedOutViewer, uuidv4());
    fail("should have thrown exception");
  } catch (e) {}
});
