import User from "src/ent/user.ts"; // default removes the suffix and transforms it...
import { IDViewer } from "src/util/id_viewer";
import CreateContactAction from "./ent/contact/actions/create_contact_action";
import { randomEmail } from "./util/random";

async function loadUserAndCreate() {
  let user = await User.loadX(
    new IDViewer("6910e947-7bc1-4ed2-b8a8-5a07e6708830"),
    "6910e947-7bc1-4ed2-b8a8-5a07e6708830",
  );

  return await CreateContactAction.create(user.viewer, {
    firstName: "firstName",
    lastName: "lastName",
    emailAddress: randomEmail(),
    userID: user.id,
  }).saveX()
}

loadUserAndCreate().then((user) => {
  console.log(user);
});
