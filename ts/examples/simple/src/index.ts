import User from "src/ent/user.ts"; // default removes the suffix and transforms it...
import { IDViewer } from "src/util/id_viewer";
import CreateContactAction from "./ent/contact/actions/create_contact_action";
import { randomEmail } from "./util/random";
import { createLoaders } from "src/ent/loaders";
import EditUserAction from "./ent/user/actions/edit_user_action";

async function loadUserAndCreate() {
  let user = await User.loadX(
    new IDViewer("6910e947-7bc1-4ed2-b8a8-5a07e6708830"),
    "6910e947-7bc1-4ed2-b8a8-5a07e6708830",
  );

  return user;

  // return await CreateContactAction.create(user.viewer, {
  //   firstName: "firstName",
  //   lastName: "lastName",
  //   emailAddress: randomEmail(),
  //   userID: user.id,
  // }).saveX()
}

// loadUserAndCreate().then((user) => {
//   console.log(user);
// });

const id = "6910e947-7bc1-4ed2-b8a8-5a07e6708830";
const id2 = "b38e3d04-4f6a-4421-a566-a211f4799c12";
const id3 = "127d5d51-f588-463d-b347-9dfbcc67fae0";

async function main() {
  const loaders = createLoaders();
  const vc = new IDViewer(id2);
  const user = await User.loadX(vc, id2);
  // const user2 = await loaders.User.load(id);
  // console.log(user1, user2);

  // loaders.User.clear(id);
  // console.log(await loaders.User.load(id));

  const action = EditUserAction.create(vc, user, {});
  action.builder.addFriend(id).addFriend(id3);
  await action.saveX();
}

Promise.resolve(main());
