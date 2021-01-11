import { User } from "src/ent";
import { DB, LoggedOutViewer } from "@lolopinto/ent";
import CreateUserAction from "../user/actions/create_user_action";

afterAll(async () => {
  await DB.getInstance().endPool();
});

test("create user", async () => {
  const user = await CreateUserAction.create(new LoggedOutViewer(), {
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: "foo@email.com",
  }).saveX();
  expect(user).toBeInstanceOf(User);
});
