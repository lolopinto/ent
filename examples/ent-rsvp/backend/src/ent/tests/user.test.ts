import { User } from "src/ent";
import { LoggedOutViewer } from "@snowtop/ent";
import CreateUserAction from "../user/actions/create_user_action";
import { randomEmail } from "src/util/random";

test("create user", async () => {
  const user = await CreateUserAction.create(new LoggedOutViewer(), {
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: randomEmail(),
    password: "pa$$w0rd",
  }).saveX();
  expect(user).toBeInstanceOf(User);
});
