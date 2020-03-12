import { LogedOutViewer } from "./../src/viewer";
import {
  PrivacyPolicy,
  AlwaysDenyRule,
  AllowIfViewerRule,
} from "./../src/privacy";
import { ID, Ent, Viewer, loadDerivedEnt, loadDerivedEntX } from "./../src/ent";

const loggedOutViewer = new LogedOutViewer();

// todo share this eventually
class IDViewer implements Viewer {
  constructor(public viewerID: ID, private ent: Ent | null = null) {}
  async viewer() {
    return this.ent;
  }
  instanceKey(): string {
    return `idViewer: ${this.viewerID}`;
  }
}

class User implements Ent {
  id: ID;
  accountID: string;
  privacyPolicy: PrivacyPolicy = {
    rules: [AllowIfViewerRule, AlwaysDenyRule],
  };
  constructor(public viewer: Viewer, data: {}) {
    this.id = data["id"];
  }

  static async load(v: Viewer, data: {}): Promise<User | null> {
    return loadDerivedEnt(v, data, User);
  }

  static async loadX(v: Viewer, data: {}): Promise<User> {
    return loadDerivedEntX(v, data, User);
  }
}

describe("loadEnt", () => {
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
