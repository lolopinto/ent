import User from "src/ent/user";
import { IDViewer } from "src/util/id_viewer";
async function load() {
  return await User.load(
    new IDViewer("6910e947-7bc1-4ed2-b8a8-5a07e6708830"),
    "6910e947-7bc1-4ed2-b8a8-5a07e6708830",
  );
}

load().then((user) => {
  console.log(user);
});
