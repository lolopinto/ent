import { User } from "../testutils/builder";
import { ID, Viewer } from "./base";

class LoggedInViewer implements Viewer<User, ID> {
  constructor(public viewerID: ID) {}

  async viewer(): Promise<User> {
    return new User(this, { id: this.viewerID });
  }
  instanceKey(): string {
    return "";
  }
}

test("always loggedin viewer", async () => {
  const v = new LoggedInViewer(1);
  expect(v.viewerID).toBe(1);
  const user = await v.viewer();
  expect(user.id).toBe(v.viewerID);
});
