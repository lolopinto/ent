import { LoggedOutViewer, IDViewer } from "./../src/viewer";
import {
  PrivacyPolicy,
  AlwaysDenyRule,
  AllowIfViewerRule,
} from "./../src/privacy";
import {
  ID,
  Ent,
  Data,
  Viewer,
  loadDerivedEnt,
  loadDerivedEntX,
} from "./../src/ent";

const loggedOutViewer = new LoggedOutViewer();

class User implements Ent {
  id: ID;
  accountID: string;
  nodeType: "User";
  privacyPolicy: PrivacyPolicy = {
    rules: [AllowIfViewerRule, AlwaysDenyRule],
  };
  constructor(public viewer: Viewer, data: Data) {
    this.id = data["id"];
  }

  static async load(v: Viewer, data: Data): Promise<User | null> {
    return loadDerivedEnt(v, data, User);
  }

  static async loadX(v: Viewer, data: Data): Promise<User> {
    return loadDerivedEntX(v, data, User);
  }
}

describe("loadDerivedEnt", () => {
  test("loggedout", async () => {
    const user = await User.load(loggedOutViewer, { id: "1" });
    expect(user).toBe(null);
  });

  test("id viewer", async () => {
    const user = await User.load(new IDViewer("1"), { id: "1" });
    expect(user).not.toBe(null);
    expect(user?.id).toBe("1");
  });
});

describe("loadEntX", () => {
  test("loggedout", async () => {
    try {
      await User.loadX(loggedOutViewer, { id: "1" });
      fail("should not have gotten here");
    } catch (e) {}
  });

  test("id viewer", async () => {
    try {
      const user = await User.loadX(new IDViewer("1"), { id: "1" });
      expect(user.id).toBe("1");
    } catch (e) {
      fail(e.message);
    }
  });
});
