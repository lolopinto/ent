import {
  ID,
  Ent,
  Viewer,
  LoadEntOptions,
  Data,
  DenyWithReason,
  Skip,
  PrivacyPolicy,
} from "./base";
import {
  applyPrivacyPolicy,
  applyPrivacyPolicyX,
  AlwaysAllowRule,
  DenyIfLoggedOutRule,
  AlwaysDenyRule,
  AllowIfViewerRule,
  AllowIfViewerIsRule,
  AllowIfFuncRule,
  AllowIfEntIsVisiblePolicy,
  DenyIfEntIsVisiblePolicy,
} from "./privacy";

import { LoggedOutViewer, IDViewer } from "./viewer";
import { Pool } from "pg";
import { QueryRecorder } from "../testutils/db_mock";
import { createRowForTest } from "../testutils/write";
import { ObjectLoaderFactory } from "./loaders";
jest.mock("pg");
QueryRecorder.mockPool(Pool);
afterEach(() => {
  QueryRecorder.clear();
});

const loggedOutViewer = new LoggedOutViewer();

class User implements Ent {
  id: ID;
  accountID: string;
  privacyPolicy: PrivacyPolicy;
  nodeType = "User";
  // TODO add policy here
  constructor(public viewer: Viewer, data: Data) {
    this.id = data.id;
  }
}

const getUser = function(
  v: Viewer,
  id: string,
  privacyPolicy: PrivacyPolicy,
  accountID: string = "2",
): User {
  const user = new User(v, { id });
  user.privacyPolicy = privacyPolicy;
  user.accountID = accountID;
  return user;
};

describe("alwaysAllowRule", () => {
  const policy = {
    rules: [AlwaysAllowRule],
  };

  test("AlwaysAllowRule", async () => {
    const user = getUser(loggedOutViewer, "1", policy);
    const bool = await applyPrivacyPolicy(user.viewer, policy, user);
    expect(bool).toBe(true);
  });

  test("id viewer", async () => {
    const user = getUser(new IDViewer("1"), "1", policy);
    const bool = await applyPrivacyPolicy(user.viewer, policy, user);
    expect(bool).toBe(true);
  });
});

describe("AlwaysDenyRule", () => {
  const policy = {
    rules: [AlwaysDenyRule],
  };

  test("loggedOutViewer", async () => {
    const user = getUser(loggedOutViewer, "1", policy);
    const bool = await applyPrivacyPolicy(user.viewer, policy, user);
    expect(bool).toBe(false);
  });

  test("id viewer", async () => {
    const user = getUser(new IDViewer("1"), "1", policy);
    const bool = await applyPrivacyPolicy(user.viewer, policy, user);
    expect(bool).toBe(false);
  });
});

describe("DenyIfLoggedOutRule", () => {
  const policy = {
    rules: [DenyIfLoggedOutRule],
  };
  const policy2 = {
    rules: [DenyIfLoggedOutRule, AlwaysAllowRule],
  };

  test("loggedOutViewer invalid rule", async () => {
    const user = getUser(loggedOutViewer, "1", policy);
    const bool = await applyPrivacyPolicy(user.viewer, policy, user);
    expect(bool).toBe(false);
  });

  test("loggedOutViewer", async () => {
    const user = getUser(loggedOutViewer, "1", policy2);
    const bool = await applyPrivacyPolicy(user.viewer, policy2, user);
    expect(bool).toBe(false);
  });

  test("id viewer invalid rule", async () => {
    const user = getUser(new IDViewer("1"), "1", policy);
    const bool = await applyPrivacyPolicy(user.viewer, policy, user);
    expect(bool).toBe(false);
  });

  test("id viewer", async () => {
    const user = getUser(new IDViewer("1"), "1", policy2);
    const bool = await applyPrivacyPolicy(user.viewer, policy2, user);
    expect(bool).toBe(true);
  });
});

describe("AllowIfViewerRule", () => {
  const policy = {
    rules: [AllowIfViewerRule],
  };
  const policy2 = {
    rules: [AllowIfViewerRule, AlwaysDenyRule],
  };

  test("loggedOutViewer invalid rule", async () => {
    const user = getUser(loggedOutViewer, "1", policy);
    const bool = await applyPrivacyPolicy(user.viewer, policy, user);
    expect(bool).toBe(false);
  });

  test("loggedOutViewer", async () => {
    const user = getUser(loggedOutViewer, "1", policy2);
    const bool = await applyPrivacyPolicy(user.viewer, policy2, user);
    expect(bool).toBe(false);
  });

  test("id viewer invalid rule", async () => {
    const user = getUser(new IDViewer("1"), "1", policy);
    const bool = await applyPrivacyPolicy(user.viewer, policy, user);
    expect(bool).toBe(true);
  });

  test("id viewer", async () => {
    const user = getUser(new IDViewer("1"), "1", policy2);
    const bool = await applyPrivacyPolicy(user.viewer, policy2, user);
    expect(bool).toBe(true);
  });

  test("different viewer", async () => {
    const user = getUser(new IDViewer("2"), "1", policy2);
    const bool = await applyPrivacyPolicy(user.viewer, policy2, user);
    expect(bool).toBe(false);
  });
});

describe("AllowIfFuncRule", () => {
  const rule = new AllowIfFuncRule(async (v: Viewer, ent: Ent) => {
    return v.viewerID === "1";
  });
  const policy = {
    rules: [rule],
  };
  const policy2 = {
    rules: [rule, AlwaysDenyRule],
  };

  test("loggedOutViewer invalid rule", async () => {
    const user = getUser(loggedOutViewer, "1", policy);
    const bool = await applyPrivacyPolicy(user.viewer, policy, user);
    expect(bool).toBe(false);
  });

  test("loggedOutViewer", async () => {
    const user = getUser(loggedOutViewer, "1", policy2);
    const bool = await applyPrivacyPolicy(user.viewer, policy2, user);
    expect(bool).toBe(false);
  });

  test("id viewer invalid rule", async () => {
    const user = getUser(new IDViewer("1"), "1", policy);
    const bool = await applyPrivacyPolicy(user.viewer, policy, user);
    expect(bool).toBe(true);
  });

  test("id viewer", async () => {
    const user = getUser(new IDViewer("1"), "1", policy2);
    const bool = await applyPrivacyPolicy(user.viewer, policy2, user);
    expect(bool).toBe(true);
  });

  test("different viewer", async () => {
    const user = getUser(new IDViewer("2"), "1", policy2);
    const bool = await applyPrivacyPolicy(user.viewer, policy2, user);
    expect(bool).toBe(false);
  });
});

describe("AllowIfViewerIsRule", () => {
  const policy = {
    rules: [new AllowIfViewerIsRule("accountID")],
  };
  const policy2 = {
    rules: [new AllowIfViewerIsRule("accountID"), AlwaysDenyRule],
  };

  test("loggedOutViewer invalid rule", async () => {
    const user = getUser(loggedOutViewer, "1", policy);
    const bool = await applyPrivacyPolicy(user.viewer, policy, user);
    expect(bool).toBe(false);
  });

  test("loggedOutViewer", async () => {
    const user = getUser(loggedOutViewer, "1", policy2);
    const bool = await applyPrivacyPolicy(user.viewer, policy2, user);
    expect(bool).toBe(false);
  });

  test("id viewer does not match account invalid rule", async () => {
    const user = getUser(new IDViewer("1"), "1", policy);
    const bool = await applyPrivacyPolicy(user.viewer, policy, user);
    expect(bool).toBe(false);
  });

  test("id viewer does not match account", async () => {
    const user = getUser(new IDViewer("1"), "1", policy2);
    const bool = await applyPrivacyPolicy(user.viewer, policy2, user);
    expect(bool).toBe(false);
  });

  test("viewer matches account id", async () => {
    const user = getUser(new IDViewer("2"), "1", policy2);
    const bool = await applyPrivacyPolicy(user.viewer, policy2, user);
    expect(bool).toBe(true);
  });
});

describe("applyPrivacyPolicyX", () => {
  const policy = {
    rules: [DenyIfLoggedOutRule, AlwaysAllowRule],
  };

  test("privacy not allowed", async () => {
    const user = getUser(loggedOutViewer, "1", policy);
    try {
      await applyPrivacyPolicyX(user.viewer, policy, user);
      fail("should not get here");
    } catch (e) {
      expect(e.message).toBe(
        `ent ${user.id} of type User is not visible for privacy reasons`,
      );
    }
  });

  test("privacy yay!", async () => {
    const user = getUser(new IDViewer("1"), "1", policy);
    try {
      const bool = await applyPrivacyPolicyX(user.viewer, policy, user);
      expect(bool).toBe(true);
    } catch (e) {
      fail(e.message);
    }
  });
});

async function createUser() {
  await createRowForTest({
    tableName: DefinedUser.loaderOptions().tableName,
    fields: {
      id: "1",
      name: "name",
    },
  });
}

class DefinedUser extends User {
  privacyPolicy: PrivacyPolicy = {
    rules: [AllowIfViewerRule, AlwaysDenyRule],
  };
  static loaderOptions(): LoadEntOptions<DefinedUser> {
    return {
      tableName: "users",
      fields: ["id", "name"],
      ent: this,
      loaderFactory: new ObjectLoaderFactory({
        fields: ["id", "name"],
        tableName: "users",
        key: "id",
      }),
    };
  }
}

describe("AllowIfEntIsVisibleRule", () => {
  beforeEach(async () => {
    await createUser();
  });
  const policy = new AllowIfEntIsVisiblePolicy(
    "1",
    DefinedUser.loaderOptions(),
  );

  test("passes", async () => {
    const vc = new IDViewer("1");
    const bool = await applyPrivacyPolicy(
      vc,
      policy,
      new DefinedUser(vc, { id: "1" }),
    );
    expect(bool).toBe(true);
  });

  test("fails", async () => {
    const vc = new IDViewer("2");
    const bool = await applyPrivacyPolicy(
      vc,
      policy,
      new DefinedUser(vc, { id: "1" }),
    );
    expect(bool).toBe(false);
  });
});

describe("DenyIfEntIsVisibleRule", () => {
  beforeEach(async () => {
    await createUser();
  });
  const policy = new DenyIfEntIsVisiblePolicy("1", DefinedUser.loaderOptions());

  test("passes", async () => {
    const vc = new IDViewer("1");
    const bool = await applyPrivacyPolicy(
      vc,
      policy,
      new DefinedUser(vc, { id: "1" }),
    );
    expect(bool).toBe(false);
  });

  test("fails", async () => {
    const vc = new IDViewer("2");
    const bool = await applyPrivacyPolicy(
      vc,
      policy,
      new DefinedUser(vc, { id: "1" }),
    );
    expect(bool).toBe(true);
  });
});

class BlockedEntError extends Error {
  constructor(public privacyPolicy: PrivacyPolicy, public entID: ID) {
    super(`blocked privacy!`);
  }
}

describe("denywithReason", () => {
  const policy = {
    rules: [
      {
        async apply(v: Viewer, ent: Ent) {
          if (v.viewerID === "1") {
            return DenyWithReason(new BlockedEntError(this, v.viewerID));
          }
          return Skip();
        },
      },
      AlwaysAllowRule,
    ],
  };

  test("privacy not allowed", async () => {
    const user = getUser(new IDViewer("1"), "1", policy);
    try {
      await applyPrivacyPolicyX(user.viewer, policy, user);
      fail("should not get here");
    } catch (e) {
      expect(e.message).toBe("blocked privacy!");
    }
  });

  test("privacy allowed!", async () => {
    const user = getUser(new IDViewer("2"), "1", policy);
    try {
      const bool = await applyPrivacyPolicyX(user.viewer, policy, user);
      expect(bool).toBe(true);
    } catch (e) {
      fail(e.message);
    }
  });
});
