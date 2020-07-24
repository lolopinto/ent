import User from "src/ent/user.ts"; // default removes the suffix and transforms it...
import { IDViewer } from "src/util/id_viewer";
import CreateContactAction from "./ent/contact/actions/create_contact_action";
import { randomEmail } from "./util/random";
import EditUserAction from "./ent/user/actions/edit_user_action";
import { loadEdges, loadEdgeData } from "ent/ent";
import { EdgeType } from "./ent/const";
import * as http from "http";
import { buildContext } from "ent/auth/context";
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
  http
    .createServer(async function(req, res) {
      let context = await buildContext(req, res);
      //      const loaders = createLoaders();

      // console.log(await loadEdgeData(EdgeType.UserToFriends));
      // console.log(await loadEdgeData(EdgeType.UserToFriends));
      //      const user2 = await loaders.User.load(id);
      // console.log(user1, user2);

      // loaders.User.clear(id);
      // console.log(await loaders.User.load(id));

      const vc = new IDViewer(id2, null, context);
      const user = await User.loadX(vc, id2);

      await user.loadFriends();
      await user.loadFriends();
      await user.loadContacts();
      // await loadEdges({
      //   id1: user.id,
      //   edgeType: EdgeType.UserToFriends,
      //   context: vc.context,
      // });
      // await loadEdges({
      //   id1: user.id,
      //   edgeType: EdgeType.UserToFriends,
      //   context: vc.context,
      // });

      res.end("c'est fini");
    })
    .listen(8080);

  // await user.loadFriendsEdges();
  // await user.loadFriendsEdges();

  // const action = EditUserAction.create(vc, user, {});
  // action.builder.addFriend(id).addFriend(id3);
  // await action.saveX();
}

Promise.resolve(main());
