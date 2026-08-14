import {
  ID,
  Ent,
  Viewer,
  LoadEntOptions,
  DenyWithReason,
  Skip,
  PrivacyPolicy,
  WriteOperation,
} from "./base.js";
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
  AllowIfEdgeExistsRule,
  AllowIfEdgeDoesNotExistRule,
  DenyIfEdgeExistsRule,
  DenyIfEdgeDoesNotExistRule,
  AllowIfEdgeExistsFromViewerToEntRule,
  AllowIfEdgeExistsFromEntToViewerRule,
  AllowIfEdgeExistsFromViewerToEntPropertyRule,
  AllowIfEdgeExistsFromEntPropertyToViewerRule,
  DenyIfEdgeExistsFromViewerToEntRule,
  DenyIfEdgeExistsFromEntToViewerRule,
  DenyIfEdgeExistsFromViewerToEntPropertyRule,
  DenyIfEdgeExistsFromEntPropertyToViewerRule,
} from "./privacy.js";

import { LoggedOutViewer, IDViewer } from "./viewer.js";
import { createRowForTest } from "../testutils/write.js";
import { ObjectLoaderFactory } from "./loaders/index.js";
import {
  assoc_edge_config_table,
  assoc_edge_table,
  setupPostgres,
  table,
  text,
} from "../testutils/db/temp_db.js";
import {
  BaseEnt,
  SimpleAction,
  SimpleBuilder,
  getBuilderSchemaFromFields,
} from "../testutils/builder.js";
import { loadEdgeData } from "./ent.js";
import { v1 } from "uuid";
import { setGlobalSchema } from "./global_schema.js";
import { testEdgeGlobalSchema } from "../testutils/test_edge_global_schema.js";

const loggedOutViewer = new LoggedOutViewer();

setupPostgres(() => [
  table("users", text("id", { primaryKey: true }), text("name")),
  assoc_edge_config_table(),
  assoc_edge_table("edge_table", true),
]);

beforeAll(async () => {
  setGlobalSchema(testEdgeGlobalSchema);

  for (const edge of ["edge"]) {
    await createRowForTest({
      tableName: "assoc_edge_config",
      fields: {
        edge_table: `${edge}_table`,
        symmetric_edge: false,
        inverse_edge_type: null,
        edge_type: edge,
        edge_name: "name",
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    const edgeData = await loadEdgeData(edge);
    expect(edgeData).toBeDefined();
  }
});

class User extends BaseEnt {
  accountID: string;

  // TODO add policy here
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return { rules: [] };
  }
  nodeType = "User";
}

const getUser = function (
  v: Viewer,
  id: string,
  privacyPolicy: PrivacyPolicy,
  accountID: string = "2",
): User {
  const user = new User(v, { id });
  user.getPrivacyPolicy = () => {
    return privacyPolicy;
  };
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

async function addEdge(user: User, id2: ID) {
  const builder = new SimpleBuilder(
    user.viewer,
    getBuilderSchemaFromFields({}, User),
    new Map(),
    WriteOperation.Edit,
    user,
  );
  builder.orchestrator.addOutboundEdge(id2, "edge", "User");
  await builder.saveX();
}

async function addInboundEdge(user: User, id2: ID) {
  const builder = new SimpleBuilder(
    user.viewer,
    getBuilderSchemaFromFields({}, User),
    new Map(),
    WriteOperation.Edit,
    user,
  );
  builder.orchestrator.addInboundEdge(id2, "edge", "User");
  await builder.saveX();
}

async function softDeleteEdge(user: User, id2: ID) {
  const builder = new SimpleBuilder(
    user.viewer,
    getBuilderSchemaFromFields({}, User),
    new Map(),
    WriteOperation.Edit,
    user,
  );
  builder.orchestrator.removeOutboundEdge(id2, "edge");
  await builder.saveX();
}

async function softDeleteInboundEdge(user: User, id2: ID) {
  const builder = new SimpleBuilder(
    user.viewer,
    getBuilderSchemaFromFields({}, User),
    new Map(),
    WriteOperation.Edit,
    user,
  );
  builder.orchestrator.removeInboundEdge(id2, "edge");
  await builder.saveX();
}

async function reallyDeleteEdge(user: User, id2: ID) {
  const builder = new SimpleBuilder(
    user.viewer,
    getBuilderSchemaFromFields({}, User),
    new Map(),
    WriteOperation.Edit,
    user,
  );
  builder.orchestrator.removeOutboundEdge(id2, "edge", {
    disableTransformations: true,
  });
  await builder.saveX();
}

async function reallyDeleteInboundEdge(user: User, id2: ID) {
  const builder = new SimpleBuilder(
    user.viewer,
    getBuilderSchemaFromFields({}, User),
    new Map(),
    WriteOperation.Edit,
    user,
  );
  builder.orchestrator.removeInboundEdge(id2, "edge", {
    disableTransformations: true,
  });
  await builder.saveX();
}

describe("AllowIfEdgeExistsRule", () => {
  const id1 = v1();
  const id2 = v1();
  const policy = {
    rules: [new AllowIfEdgeExistsRule(id1, id2, "edge")],
  };
  const policy2 = {
    rules: [
      new AllowIfEdgeExistsRule(id1, id2, "edge", {
        disableTransformations: true,
      }),
    ],
  };
  const user = getUser(loggedOutViewer, id1, policy);
  const user2 = getUser(loggedOutViewer, id1, policy2);

  test("edge exists", async () => {
    await addEdge(user, id2);

    const bool = await applyPrivacyPolicy(user.viewer, policy, user);
    expect(bool).toBe(true);

    const bool2 = await applyPrivacyPolicy(user2.viewer, policy2, user2);
    expect(bool2).toBe(true);
  });

  test("edge does not exist", async () => {
    const bool = await applyPrivacyPolicy(user.viewer, policy, user);
    expect(bool).toBe(false);

    const bool2 = await applyPrivacyPolicy(user2.viewer, policy2, user2);
    expect(bool2).toBe(false);
  });

  test("edge soft deleted", async () => {
    await addEdge(user, id2);
    await softDeleteEdge(user, id2);

    const bool = await applyPrivacyPolicy(user.viewer, policy, user);
    expect(bool).toBe(false);

    const bool2 = await applyPrivacyPolicy(user2.viewer, policy2, user2);
    expect(bool2).toBe(true);
  });

  test("edge really deleted", async () => {
    await addEdge(user, id2);
    await reallyDeleteEdge(user, id2);

    const bool = await applyPrivacyPolicy(user.viewer, policy, user);
    expect(bool).toBe(false);

    const bool2 = await applyPrivacyPolicy(user2.viewer, policy2, user2);
    expect(bool2).toBe(false);
  });
});

describe("AllowIfEdgeDoesNotExistRule", () => {
  const id1 = v1();
  const id2 = v1();
  const policy = {
    rules: [new AllowIfEdgeDoesNotExistRule(id1, id2, "edge"), AlwaysDenyRule],
  };
  const policy2 = {
    rules: [
      new AllowIfEdgeDoesNotExistRule(id1, id2, "edge", {
        disableTransformations: true,
      }),
      AlwaysDenyRule,
    ],
  };
  const user = getUser(loggedOutViewer, id1, policy);
  const user2 = getUser(loggedOutViewer, id1, policy2);

  test("edge exists", async () => {
    await addEdge(user, id2);

    const bool = await applyPrivacyPolicy(user.viewer, policy, user);
    expect(bool).toBe(false);

    const bool2 = await applyPrivacyPolicy(user2.viewer, policy2, user2);
    expect(bool2).toBe(false);
  });

  test("edge does not exist", async () => {
    const bool = await applyPrivacyPolicy(user.viewer, policy, user);
    expect(bool).toBe(true);

    const bool2 = await applyPrivacyPolicy(user2.viewer, policy2, user2);
    expect(bool2).toBe(true);
  });

  test("edge soft deleted", async () => {
    await addEdge(user, id2);
    await softDeleteEdge(user, id2);

    const bool = await applyPrivacyPolicy(user.viewer, policy, user);
    expect(bool).toBe(true);

    const bool2 = await applyPrivacyPolicy(user2.viewer, policy2, user2);
    expect(bool2).toBe(false);
  });

  test("edge really deleted", async () => {
    await addEdge(user, id2);
    await reallyDeleteEdge(user, id2);

    const bool = await applyPrivacyPolicy(user.viewer, policy, user);
    expect(bool).toBe(true);

    const bool2 = await applyPrivacyPolicy(user2.viewer, policy2, user2);
    expect(bool2).toBe(true);
  });
});

describe("AllowIfEdgeExistsFromViewerToEntRule", () => {
  const id1 = v1();
  const id2 = v1();
  const policy = {
    rules: [new AllowIfEdgeExistsFromViewerToEntRule("edge")],
  };
  const policy2 = {
    rules: [
      new AllowIfEdgeExistsFromViewerToEntRule("edge", {
        disableTransformations: true,
      }),
    ],
  };
  const id1Viewer = new IDViewer(id1);
  const user = getUser(id1Viewer, id1, policy);
  const user2 = getUser(id1Viewer, id2, policy2);

  test("edge exists", async () => {
    await addEdge(user, id2);

    // edge exists for user -> user2
    const bool = await applyPrivacyPolicy(id1Viewer, policy, user2);
    expect(bool).toBe(true);

    // edge exists
    const bool2 = await applyPrivacyPolicy(id1Viewer, policy2, user2);
    expect(bool2).toBe(true);
  });

  test("edge does not exist", async () => {
    const bool = await applyPrivacyPolicy(id1Viewer, policy, user2);
    expect(bool).toBe(false);

    const bool2 = await applyPrivacyPolicy(id1Viewer, policy2, user2);
    expect(bool2).toBe(false);
  });

  test("edge soft deleted", async () => {
    await addEdge(user, id2);
    await softDeleteEdge(user, id2);

    const bool = await applyPrivacyPolicy(id1Viewer, policy, user2);
    expect(bool).toBe(false);

    const bool2 = await applyPrivacyPolicy(id1Viewer, policy2, user2);
    expect(bool2).toBe(true);
  });

  test("edge really deleted", async () => {
    await addEdge(user, id2);
    await reallyDeleteEdge(user, id2);

    const bool = await applyPrivacyPolicy(id1Viewer, policy, user2);
    expect(bool).toBe(false);

    const bool2 = await applyPrivacyPolicy(id1Viewer, policy2, user2);
    expect(bool2).toBe(false);
  });
});

describe("AllowIfEdgeExistsFromEntToViewerRule", () => {
  const id1 = v1();
  const id2 = v1();
  const policy = {
    rules: [new AllowIfEdgeExistsFromEntToViewerRule("edge")],
  };
  const policy2 = {
    rules: [
      new AllowIfEdgeExistsFromEntToViewerRule("edge", {
        disableTransformations: true,
      }),
    ],
  };
  const id1Viewer = new IDViewer(id1);
  const user = getUser(id1Viewer, id1, policy);
  const user2 = getUser(id1Viewer, id2, policy2);

  test("edge exists", async () => {
    await addEdge(user2, id1);

    // edge exists for user2 -> user
    const bool = await applyPrivacyPolicy(id1Viewer, policy, user2);
    expect(bool).toBe(true);

    // edge exists
    const bool2 = await applyPrivacyPolicy(id1Viewer, policy2, user2);
    expect(bool2).toBe(true);
  });

  test("edge does not exist", async () => {
    const bool = await applyPrivacyPolicy(id1Viewer, policy, user2);
    expect(bool).toBe(false);

    const bool2 = await applyPrivacyPolicy(id1Viewer, policy2, user2);
    expect(bool2).toBe(false);
  });

  test("edge soft deleted", async () => {
    await addEdge(user2, id1);
    await softDeleteEdge(user2, id1);

    const bool = await applyPrivacyPolicy(id1Viewer, policy, user2);
    expect(bool).toBe(false);

    const bool2 = await applyPrivacyPolicy(id1Viewer, policy2, user2);
    expect(bool2).toBe(true);
  });

  test("edge really deleted", async () => {
    await addEdge(user2, id1);
    await reallyDeleteEdge(user2, id1);

    const bool = await applyPrivacyPolicy(id1Viewer, policy, user2);
    expect(bool).toBe(false);

    const bool2 = await applyPrivacyPolicy(id1Viewer, policy2, user2);
    expect(bool2).toBe(false);
  });
});

describe("AllowIfEdgeExistsFromViewerToEntPropertyRule", () => {
  const id1 = v1();
  const id2 = v1();
  const id1AccountId = v1();
  const id2AccountId = v1();
  const policy = {
    rules: [
      new AllowIfEdgeExistsFromViewerToEntPropertyRule<User>(
        "accountID",
        "edge",
      ),
    ],
  };
  const policy2 = {
    rules: [
      new AllowIfEdgeExistsFromViewerToEntPropertyRule<User>(
        "accountID",
        "edge",
        {
          disableTransformations: true,
        },
      ),
    ],
  };
  const id1Viewer = new IDViewer(id1);
  const user = getUser(id1Viewer, id1, policy, id1AccountId);
  const user2 = getUser(id1Viewer, id2, policy2, id2AccountId);

  test("edge exists", async () => {
    await addEdge(user, id2AccountId);

    // edge exists for user -> id1AccountId
    const bool = await applyPrivacyPolicy(id1Viewer, policy, user2);
    expect(bool).toBe(true);

    // edge exists
    const bool2 = await applyPrivacyPolicy(id1Viewer, policy2, user2);
    expect(bool2).toBe(true);
  });

  test("edge does not exist", async () => {
    const bool = await applyPrivacyPolicy(id1Viewer, policy, user2);
    expect(bool).toBe(false);

    const bool2 = await applyPrivacyPolicy(id1Viewer, policy2, user2);
    expect(bool2).toBe(false);
  });

  test("edge soft deleted", async () => {
    await addEdge(user, id2AccountId);
    await softDeleteEdge(user, id2AccountId);

    // edge exists for user -> id1AccountId
    const bool = await applyPrivacyPolicy(id1Viewer, policy, user2);
    expect(bool).toBe(false);

    // edge exists
    const bool2 = await applyPrivacyPolicy(id1Viewer, policy2, user2);
    expect(bool2).toBe(true);
  });

  test("edge really deleted", async () => {
    await addEdge(user, id2AccountId);
    await reallyDeleteEdge(user, id2AccountId);

    const bool = await applyPrivacyPolicy(id1Viewer, policy, user2);
    expect(bool).toBe(false);

    const bool2 = await applyPrivacyPolicy(id1Viewer, policy2, user2);
    expect(bool2).toBe(false);
  });
});

describe("AllowIfEdgeExistsFromEntPropertyToViewerRule", () => {
  const id1 = v1();
  const id2 = v1();
  const id1AccountId = v1();
  const id2AccountId = v1();
  const policy = {
    rules: [
      new AllowIfEdgeExistsFromEntPropertyToViewerRule<User>(
        "accountID",
        "edge",
      ),
    ],
  };
  const policy2 = {
    rules: [
      new AllowIfEdgeExistsFromEntPropertyToViewerRule<User>(
        "accountID",
        "edge",
        {
          disableTransformations: true,
        },
      ),
    ],
  };
  const id1Viewer = new IDViewer(id1);
  const user = getUser(id1Viewer, id1, policy, id1AccountId);
  const user2 = getUser(id1Viewer, id2, policy2, id2AccountId);

  test("edge exists", async () => {
    await addInboundEdge(user, id2AccountId);

    // edge exists for user -> id1AccountId
    const bool = await applyPrivacyPolicy(id1Viewer, policy, user2);
    expect(bool).toBe(true);

    // edge exists
    const bool2 = await applyPrivacyPolicy(id1Viewer, policy2, user2);
    expect(bool2).toBe(true);
  });

  test("edge does not exist", async () => {
    const bool = await applyPrivacyPolicy(id1Viewer, policy, user2);
    expect(bool).toBe(false);

    const bool2 = await applyPrivacyPolicy(id1Viewer, policy2, user2);
    expect(bool2).toBe(false);
  });

  test("edge soft deleted", async () => {
    await addInboundEdge(user, id2AccountId);
    await softDeleteInboundEdge(user, id2AccountId);

    // edge exists for user -> id1AccountId
    const bool = await applyPrivacyPolicy(id1Viewer, policy, user2);
    expect(bool).toBe(false);

    // edge exists
    const bool2 = await applyPrivacyPolicy(id1Viewer, policy2, user2);
    expect(bool2).toBe(true);
  });

  test("edge really deleted", async () => {
    await addEdge(user, id2AccountId);
    await reallyDeleteInboundEdge(user, id2AccountId);

    const bool = await applyPrivacyPolicy(id1Viewer, policy, user2);
    expect(bool).toBe(false);

    const bool2 = await applyPrivacyPolicy(id1Viewer, policy2, user2);
    expect(bool2).toBe(false);
  });
});

describe("DenyIfEdgeExistsRule", () => {
  const id1 = v1();
  const id2 = v1();
  const policy = {
    rules: [new DenyIfEdgeExistsRule(id1, id2, "edge"), AlwaysAllowRule],
  };
  const policy2 = {
    rules: [
      new DenyIfEdgeExistsRule(id1, id2, "edge", {
        disableTransformations: true,
      }),
      AlwaysAllowRule,
    ],
  };
  const user = getUser(loggedOutViewer, id1, policy);
  const user2 = getUser(loggedOutViewer, id1, policy2);

  test("edge exists", async () => {
    await addEdge(user, id2);

    const bool = await applyPrivacyPolicy(user.viewer, policy, user);
    expect(bool).toBe(false);

    const bool2 = await applyPrivacyPolicy(user2.viewer, policy2, user2);
    expect(bool2).toBe(false);
  });

  test("edge does not exist", async () => {
    const bool = await applyPrivacyPolicy(user.viewer, policy, user);
    expect(bool).toBe(true);

    const bool2 = await applyPrivacyPolicy(user2.viewer, policy2, user2);
    expect(bool2).toBe(true);
  });

  test("edge soft deleted", async () => {
    await addEdge(user, id2);
    await softDeleteEdge(user, id2);

    const bool = await applyPrivacyPolicy(user.viewer, policy, user);
    expect(bool).toBe(true);

    const bool2 = await applyPrivacyPolicy(user2.viewer, policy2, user2);
    expect(bool2).toBe(false);
  });

  test("edge really deleted", async () => {
    await addEdge(user, id2);
    await reallyDeleteEdge(user, id2);

    const bool = await applyPrivacyPolicy(user.viewer, policy, user);
    expect(bool).toBe(true);

    const bool2 = await applyPrivacyPolicy(user2.viewer, policy2, user2);
    expect(bool2).toBe(true);
  });
});

describe("DenyIfEdgeDoesNotExistRule", () => {
  const id1 = v1();
  const id2 = v1();
  const policy = {
    rules: [new DenyIfEdgeDoesNotExistRule(id1, id2, "edge"), AlwaysAllowRule],
  };
  const policy2 = {
    rules: [
      new DenyIfEdgeDoesNotExistRule(id1, id2, "edge", {
        disableTransformations: true,
      }),
      AlwaysAllowRule,
    ],
  };
  const user = getUser(loggedOutViewer, id1, policy);
  const user2 = getUser(loggedOutViewer, id1, policy2);

  test("edge exists", async () => {
    await addEdge(user, id2);

    const bool = await applyPrivacyPolicy(user.viewer, policy, user);
    expect(bool).toBe(true);

    const bool2 = await applyPrivacyPolicy(user2.viewer, policy2, user2);
    expect(bool2).toBe(true);
  });

  test("edge does not exist", async () => {
    const bool = await applyPrivacyPolicy(user.viewer, policy, user);
    expect(bool).toBe(false);

    const bool2 = await applyPrivacyPolicy(user2.viewer, policy2, user2);
    expect(bool2).toBe(false);
  });

  test("edge soft deleted", async () => {
    await addEdge(user, id2);
    await softDeleteEdge(user, id2);

    const bool = await applyPrivacyPolicy(user.viewer, policy, user);
    expect(bool).toBe(false);

    const bool2 = await applyPrivacyPolicy(user2.viewer, policy2, user2);
    expect(bool2).toBe(true);
  });

  test("edge really deleted", async () => {
    await addEdge(user, id2);
    await reallyDeleteEdge(user, id2);

    const bool = await applyPrivacyPolicy(user.viewer, policy, user);
    expect(bool).toBe(false);

    const bool2 = await applyPrivacyPolicy(user2.viewer, policy2, user2);
    expect(bool2).toBe(false);
  });
});

describe("DenyIfEdgeExistsFromViewerToEntRule", () => {
  const id1 = v1();
  const id2 = v1();
  const policy = {
    rules: [new DenyIfEdgeExistsFromViewerToEntRule("edge"), AlwaysAllowRule],
  };
  const policy2 = {
    rules: [
      new DenyIfEdgeExistsFromViewerToEntRule("edge", {
        disableTransformations: true,
      }),
      AlwaysAllowRule,
    ],
  };
  const id1Viewer = new IDViewer(id1);
  const user = getUser(id1Viewer, id1, policy);
  const user2 = getUser(id1Viewer, id2, policy2);

  test("edge exists", async () => {
    await addEdge(user, id2);

    const bool = await applyPrivacyPolicy(id1Viewer, policy, user2);
    expect(bool).toBe(false);

    const bool2 = await applyPrivacyPolicy(id1Viewer, policy2, user2);
    expect(bool2).toBe(false);
  });

  test("edge does not exist", async () => {
    const bool = await applyPrivacyPolicy(id1Viewer, policy, user2);
    expect(bool).toBe(true);

    const bool2 = await applyPrivacyPolicy(id1Viewer, policy2, user2);
    expect(bool2).toBe(true);
  });

  test("edge soft deleted", async () => {
    await addEdge(user, id2);
    await softDeleteEdge(user, id2);

    const bool = await applyPrivacyPolicy(id1Viewer, policy, user2);
    expect(bool).toBe(true);

    const bool2 = await applyPrivacyPolicy(id1Viewer, policy2, user2);
    expect(bool2).toBe(false);
  });

  test("edge really deleted", async () => {
    await addEdge(user, id2);
    await reallyDeleteEdge(user, id2);

    const bool = await applyPrivacyPolicy(id1Viewer, policy, user2);
    expect(bool).toBe(true);

    const bool2 = await applyPrivacyPolicy(id1Viewer, policy2, user2);
    expect(bool2).toBe(true);
  });
});

describe("DenyIfEdgeExistsFromEntToViewerRule", () => {
  const id1 = v1();
  const id2 = v1();
  const policy = {
    rules: [new DenyIfEdgeExistsFromEntToViewerRule("edge"), AlwaysAllowRule],
  };
  const policy2 = {
    rules: [
      new DenyIfEdgeExistsFromEntToViewerRule("edge", {
        disableTransformations: true,
      }),
      AlwaysAllowRule,
    ],
  };
  const id1Viewer = new IDViewer(id1);
  const user = getUser(id1Viewer, id1, policy);
  const user2 = getUser(id1Viewer, id2, policy2);

  test("edge exists", async () => {
    await addEdge(user2, id1);

    const bool = await applyPrivacyPolicy(id1Viewer, policy, user2);
    expect(bool).toBe(false);

    const bool2 = await applyPrivacyPolicy(id1Viewer, policy2, user2);
    expect(bool2).toBe(false);
  });

  test("edge does not exist", async () => {
    const bool = await applyPrivacyPolicy(id1Viewer, policy, user2);
    expect(bool).toBe(true);

    const bool2 = await applyPrivacyPolicy(id1Viewer, policy2, user2);
    expect(bool2).toBe(true);
  });

  test("edge soft deleted", async () => {
    await addEdge(user2, id1);
    await softDeleteEdge(user2, id1);

    const bool = await applyPrivacyPolicy(id1Viewer, policy, user2);
    expect(bool).toBe(true);

    const bool2 = await applyPrivacyPolicy(id1Viewer, policy2, user2);
    expect(bool2).toBe(false);
  });

  test("edge really deleted", async () => {
    await addEdge(user2, id1);
    await reallyDeleteEdge(user2, id1);

    const bool = await applyPrivacyPolicy(id1Viewer, policy, user2);
    expect(bool).toBe(true);

    const bool2 = await applyPrivacyPolicy(id1Viewer, policy2, user2);
    expect(bool2).toBe(true);
  });
});

describe("DenyIfEdgeExistsFromViewerToEntPropertyRule", () => {
  const id1 = v1();
  const id2 = v1();
  const id1AccountId = v1();
  const id2AccountId = v1();
  const policy = {
    rules: [
      new DenyIfEdgeExistsFromViewerToEntPropertyRule<User>(
        "accountID",
        "edge",
      ),
      AlwaysAllowRule,
    ],
  };
  const policy2 = {
    rules: [
      new DenyIfEdgeExistsFromViewerToEntPropertyRule<User>(
        "accountID",
        "edge",
        {
          disableTransformations: true,
        },
      ),
      AlwaysAllowRule,
    ],
  };
  const id1Viewer = new IDViewer(id1);
  const user = getUser(id1Viewer, id1, policy, id1AccountId);
  const user2 = getUser(id1Viewer, id2, policy2, id2AccountId);

  test("edge exists", async () => {
    await addEdge(user, id2AccountId);

    const bool = await applyPrivacyPolicy(id1Viewer, policy, user2);
    expect(bool).toBe(false);

    const bool2 = await applyPrivacyPolicy(id1Viewer, policy2, user2);
    expect(bool2).toBe(false);
  });

  test("edge does not exist", async () => {
    const bool = await applyPrivacyPolicy(id1Viewer, policy, user2);
    expect(bool).toBe(true);

    const bool2 = await applyPrivacyPolicy(id1Viewer, policy2, user2);
    expect(bool2).toBe(true);
  });

  test("edge soft deleted", async () => {
    await addEdge(user, id2AccountId);
    await softDeleteEdge(user, id2AccountId);

    const bool = await applyPrivacyPolicy(id1Viewer, policy, user2);
    expect(bool).toBe(true);

    const bool2 = await applyPrivacyPolicy(id1Viewer, policy2, user2);
    expect(bool2).toBe(false);
  });

  test("edge really deleted", async () => {
    await addEdge(user, id2AccountId);
    await reallyDeleteEdge(user, id2AccountId);

    const bool = await applyPrivacyPolicy(id1Viewer, policy, user2);
    expect(bool).toBe(true);

    const bool2 = await applyPrivacyPolicy(id1Viewer, policy2, user2);
    expect(bool2).toBe(true);
  });
});

describe("DenyIfEdgeExistsFromEntPropertyToViewerRule", () => {
  const id1 = v1();
  const id2 = v1();
  const id1AccountId = v1();
  const id2AccountId = v1();
  const policy = {
    rules: [
      new DenyIfEdgeExistsFromEntPropertyToViewerRule<User>(
        "accountID",
        "edge",
      ),
      AlwaysAllowRule,
    ],
  };
  const policy2 = {
    rules: [
      new DenyIfEdgeExistsFromEntPropertyToViewerRule<User>(
        "accountID",
        "edge",
        {
          disableTransformations: true,
        },
      ),
      AlwaysAllowRule,
    ],
  };
  const id1Viewer = new IDViewer(id1);
  const user = getUser(id1Viewer, id1, policy, id1AccountId);
  const user2 = getUser(id1Viewer, id2, policy2, id2AccountId);

  test("edge exists", async () => {
    await addInboundEdge(user, id2AccountId);

    const bool = await applyPrivacyPolicy(id1Viewer, policy, user2);
    expect(bool).toBe(false);

    const bool2 = await applyPrivacyPolicy(id1Viewer, policy2, user2);
    expect(bool2).toBe(false);
  });

  test("edge does not exist", async () => {
    const bool = await applyPrivacyPolicy(id1Viewer, policy, user2);
    expect(bool).toBe(true);

    const bool2 = await applyPrivacyPolicy(id1Viewer, policy2, user2);
    expect(bool2).toBe(true);
  });

  test("edge soft deleted", async () => {
    await addInboundEdge(user, id2AccountId);
    await softDeleteInboundEdge(user, id2AccountId);

    const bool = await applyPrivacyPolicy(id1Viewer, policy, user2);
    expect(bool).toBe(true);

    const bool2 = await applyPrivacyPolicy(id1Viewer, policy2, user2);
    expect(bool2).toBe(false);
  });

  test("edge really deleted", async () => {
    await addInboundEdge(user, id2AccountId);
    await reallyDeleteInboundEdge(user, id2AccountId);

    const bool = await applyPrivacyPolicy(id1Viewer, policy, user2);
    expect(bool).toBe(true);

    const bool2 = await applyPrivacyPolicy(id1Viewer, policy2, user2);
    expect(bool2).toBe(true);
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
      throw new Error("should not get here");
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
      throw new Error(e.message);
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
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return {
      rules: [AllowIfViewerRule, AlwaysDenyRule],
    };
  }
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
  constructor(
    public privacyPolicy: PrivacyPolicy,
    public entID: ID,
  ) {
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
      throw new Error("should not get here");
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
      throw new Error(e.message);
    }
  });
});

describe("denywithReason string", () => {
  const policy = {
    rules: [
      {
        async apply(v: Viewer, ent: Ent) {
          if (v.viewerID === "1") {
            return DenyWithReason("bye felicia");
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
      throw new Error("should not get here");
    } catch (e) {
      expect(e.message).toBe("bye felicia");
    }
  });

  test("privacy allowed!", async () => {
    const user = getUser(new IDViewer("2"), "1", policy);
    try {
      const bool = await applyPrivacyPolicyX(user.viewer, policy, user);
      expect(bool).toBe(true);
    } catch (e) {
      throw new Error(e.message);
    }
  });
});
