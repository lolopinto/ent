import User, {createUser, editUser, deleteUser, UserCreateInput} from "../../src/ent/user_manual";
import DB from "../../../../src/db";
import { v4 as uuidv4 } from 'uuid';

// TODO we need something that does this by default for all tests
afterAll(async () => {
  await DB.getInstance().endPool();
});

async function create(input:UserCreateInput ): Promise<User> {
  let user = await createUser(input);
  if (user == null) {
    fail("could not create user");
  }
  return user;
};

test('create user', async () => {
  try {
    let user = await create({firstName: "Jon", lastName: "Snow"});

    expect(user.firstName).toBe("Jon");
    expect(user.lastName).toBe("Snow");
  } catch (e) {
    fail("should not have gotten here");
  }
});

test('edit user', async () => {
  try {
    let user = await create({firstName: "Jon", lastName: "Snow"});

    let editedUser = await editUser(user.id, {firstName: "First of his name"});

    expect(editedUser).not.toBe(null);
    expect(editedUser?.firstName).toBe("First of his name");
    expect(editedUser?.lastName).toBe("Snow");
  } catch (e) {
    fail("should not have gotten here");
  }
})

test('delete user', async () => {
  try {
    let user = await create({firstName: "Jon", lastName: "Snow"});

    await deleteUser(user.id);

    let loadedUser = await User.load(user.id);
    expect(loadedUser).toBe(null);
  } catch (e) {
    fail("should not have gotten here " + e.message);
  }
})

test('loadX', async () => {
  try {
    await User.loadX(uuidv4());
    fail("should have thrown exception");
  } catch (e) {
  }
})

