import { WriteOperation } from "../action";
import {
  User,
  BuilderSchema,
  SimpleBuilder,
  SimpleAction,
  BaseEnt,
} from "../testutils/builder";
import { IDViewer, LoggedOutViewer } from "./viewer";
import { FieldMap, StringType, UUIDType } from "../schema";
import { createRowForTest } from "../testutils/write";
import { Data, PrivacyPolicy, Viewer, LoadEntOptions } from "./base";
import {
  AssocEdge,
  getEdgeTypeInGroup,
  loadCustomEdges,
  loadEdges,
  loadDerivedEnt,
  loadDerivedEntX,
  loadEnt,
  loadEntX,
  loadEntViaKey,
  loadEntXViaKey,
} from "./ent";
import { AlwaysDenyRule, AllowIfViewerRule } from "./privacy";
import { TestContext } from "../testutils/context/test_context";
import { ObjectLoaderFactory } from "./loaders";
import { validate as validatev4 } from "uuid";
import {
  table,
  text,
  setupSqlite,
  assoc_edge_config_table,
  assoc_edge_table,
  TempDB,
} from "../testutils/db/temp_db";
import { setLogLevels } from "./logger";
import { MockLogs } from "../testutils/mock_log";
import DB, { Dialect } from "./db";

class UserSchema implements BuilderSchema<User> {
  ent = User;
  fields: FieldMap = {
    id: UUIDType(),
    foo: StringType(),
  };
}
const viewer = new LoggedOutViewer();
const schema = new UserSchema();

function getUserCreateBuilder(): SimpleBuilder<User> {
  return new SimpleBuilder(
    viewer,
    schema,
    new Map([
      ["id", "{id}"],
      ["foo", "bar"],
    ]),
    WriteOperation.Insert,
    null,
  );
}

function getUserEditBuilder(
  user: User,
  m: Map<string, any>,
): SimpleBuilder<User> {
  return new SimpleBuilder(
    new IDViewer(user.id),
    schema,
    m,
    WriteOperation.Edit,
    user,
  );
}

async function createUser(): Promise<User> {
  const builder = getUserCreateBuilder();
  await builder.saveX();
  return await builder.editedEntX();
}

async function createEdgeRows(edges: string[], table?: string) {
  for (const edge of edges) {
    await createRowForTest({
      tableName: "assoc_edge_config",
      fields: {
        edge_table: table ?? `${edge}_table`,
        symmetric_edge: false,
        inverse_edge_type: null,
        edge_type: edge,
        edge_name: "name",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });
  }
}

const loggedOutViewer = new LoggedOutViewer();

class DerivedUser extends BaseEnt {
  accountID: string;
  nodeType = "User";
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return {
      rules: [AllowIfViewerRule, AlwaysDenyRule],
    };
  }

  static async load(v: Viewer, data: Data): Promise<DerivedUser | null> {
    return loadDerivedEnt(v, data, DerivedUser);
  }

  static async loadX(v: Viewer, data: Data): Promise<DerivedUser> {
    return loadDerivedEntX(v, data, DerivedUser);
  }
}

function commonTests() {
  describe("loadDerivedEnt", () => {
    test("loggedout", async () => {
      const user = await DerivedUser.load(loggedOutViewer, { id: "1" });
      expect(user).toBe(null);
    });

    test("id viewer", async () => {
      const user = await DerivedUser.load(new IDViewer("1"), { id: "1" });
      expect(user).not.toBe(null);
      expect(user?.id).toBe("1");
    });
  });

  describe("loadDerivedEntX", () => {
    test("loggedout", async () => {
      try {
        await DerivedUser.loadX(loggedOutViewer, { id: "1" });
        throw new Error("should not have gotten here");
      } catch (e) {}
    });

    test("id viewer", async () => {
      try {
        const user = await DerivedUser.loadX(new IDViewer("1"), { id: "1" });
        expect(user.id).toBe("1");
      } catch (e) {
        throw new Error(e.message);
      }
    });
  });

  test("getEdgeTypeInGroup different table", async () => {
    const edgeTypes = ["edge1", "edge2", "edge3"];
    let m = new Map<string, string>();
    for (const edgeType of edgeTypes) {
      m.set(edgeType + "Enum", edgeType);
    }

    await createEdgeRows(edgeTypes);
    const [user1, user2] = await Promise.all([createUser(), createUser()]);

    // nothing set yet
    const res1 = await getEdgeTypeInGroup(
      new IDViewer(user1.id),
      user1.id,
      user2.id,
      m,
    );
    expect(res1).toBeUndefined();

    // TODO should be able to do empty map here
    const builder = getUserEditBuilder(user1, new Map([["foo", "bar2"]]));

    // let's manually do edge1Group and then we'll set separate edges...
    builder.orchestrator.addOutboundEdge(user2.id, "edge1", user2.nodeType);
    await builder.saveX();

    const res2 = await getEdgeTypeInGroup(
      new IDViewer(user1.id),
      user1.id,
      user2.id,
      m,
    );
    expect(res2).toBeDefined();
    expect(res2![0]).toBe("edge1Enum");
    const edge = res2![1];
    expect(edge).toBeDefined();
    expect(edge?.id1).toBe(user1.id);
    expect(edge?.id2).toBe(user2.id);
    expect(edge?.edgeType).toBe("edge1");

    async function verifyEdges(edgeSet: string) {
      const res = await getEdgeTypeInGroup(
        new IDViewer(user1.id),
        user1.id,
        user2.id,
        m,
      );
      expect(res).toBeDefined();
      expect(res![0]).toBe(edgeSet + "Enum");
      const edge = res![1];
      expect(edge).toBeDefined();
      expect(edge?.id1).toBe(user1.id);
      expect(edge?.id2).toBe(user2.id);
      expect(edge?.edgeType).toBe(edgeSet);
    }

    for (const edgeType of edgeTypes) {
      const builder2 = getUserEditBuilder(user1, new Map([["foo", "bar2"]]));

      for (const edgeType2 of edgeTypes) {
        if (edgeType === edgeType2) {
          builder2.orchestrator.addOutboundEdge(user2.id, edgeType2, "User");
        } else {
          builder2.orchestrator.removeOutboundEdge(user2.id, edgeType2);
        }
      }

      await builder2.saveX();
      // verify said edge is set and others unset
      await verifyEdges(edgeType);
    }
  });

  test("getEdgeTypeInGroup same table", async () => {
    await getTempDB().create(assoc_edge_table("edge_group"));

    const edgeTypes = ["edge1Group", "edge2Group", "edge3Group"];
    await createEdgeRows(edgeTypes, "edge_group");

    let m = new Map<string, string>();
    for (const edgeType of edgeTypes) {
      m.set(edgeType + "Enum", edgeType);
    }

    const [user1, user2] = await Promise.all([createUser(), createUser()]);

    // nothing set yet
    const res1 = await getEdgeTypeInGroup(
      new IDViewer(user1.id),
      user1.id,
      user2.id,
      m,
    );
    expect(res1).toBeUndefined();

    // TODO should be able to do empty map here
    const builder = getUserEditBuilder(user1, new Map([["foo", "bar2"]]));

    // let's manually do edge1 and then we'll set separate edges...
    builder.orchestrator.addOutboundEdge(
      user2.id,
      "edge1Group",
      user2.nodeType,
    );
    await builder.saveX();

    const res2 = await getEdgeTypeInGroup(
      new IDViewer(user1.id),
      user1.id,
      user2.id,
      m,
    );
    expect(res2).toBeDefined();
    expect(res2![0]).toBe("edge1GroupEnum");
    const edge = res2![1];
    expect(edge).toBeDefined();
    expect(edge?.id1).toBe(user1.id);
    expect(edge?.id2).toBe(user2.id);
    expect(edge?.edgeType).toBe("edge1Group");

    async function verifyEdges(edgeSet: string) {
      const res = await getEdgeTypeInGroup(
        new IDViewer(user1.id),
        user1.id,
        user2.id,
        m,
      );
      expect(res).toBeDefined();
      expect(res![0]).toBe(edgeSet + "Enum");
      const edge = res![1];
      expect(edge).toBeDefined();
      expect(edge?.id1).toBe(user1.id);
      expect(edge?.id2).toBe(user2.id);
      expect(edge?.edgeType).toBe(edgeSet);
    }

    for (const edgeType of edgeTypes) {
      const builder2 = getUserEditBuilder(user1, new Map([["foo", "bar2"]]));

      for (const edgeType2 of edgeTypes) {
        if (edgeType === edgeType2) {
          builder2.orchestrator.addOutboundEdge(user2.id, edgeType2, "User");
        } else {
          builder2.orchestrator.removeOutboundEdge(user2.id, edgeType2);
        }
      }

      await builder2.saveX();
      // verify said edge is set and others unset
      await verifyEdges(edgeType);
    }
  });

  test("custom edge", async () => {
    class AssocEdgeSubclass extends AssocEdge {}
    const user = await createUser();
    const builder = getUserEditBuilder(user, new Map([["foo", "bar2"]]));
    builder.orchestrator.addOutboundEdge(user.id, "edge", "User");
    await builder.saveX();

    const edges = await loadCustomEdges({
      id1: user.id,
      edgeType: "edge",
      ctr: AssocEdgeSubclass,
    });
    expect(edges.length).toBe(1);
    const edge = edges[0];
    expect(edge).toBeInstanceOf(AssocEdgeSubclass);

    const edges2 = await loadEdges({
      id1: user.id,
      edgeType: "edge",
    });
    expect(edges2.length).toBe(1);
    const edge2 = edges2[0];
    expect(edge2).toBeInstanceOf(AssocEdge);
  });

  describe("loadEnt(X)", () => {
    const noCtxV = new LoggedOutViewer();
    const fields = ["id", "foo"];
    const tableName = "users";

    const options: LoadEntOptions<User> = {
      ent: User,
      fields,
      tableName,
      loaderFactory: new ObjectLoaderFactory({ fields, tableName, key: "id" }),
    };
    const ctx = new TestContext();

    afterEach(() => {
      ctx.cache.clearCache();
    });

    test("loadEnt. no data. no context", async () => {
      const ent = await loadEnt(noCtxV, "1", options);
      expect(ent).toBeNull();
    });

    test("loadEnt. no data. with context", async () => {
      const ent = await loadEnt(ctx.getViewer(), "1", options);
      expect(ent).toBeNull();
    });

    test("loadEntX. no data. no context", async () => {
      try {
        await loadEntX(noCtxV, "1", options);
        throw new Error("should have thrown");
      } catch (e) {
        expect(e.message).toMatch(/couldn't find row for value/);
      }
    });

    test("loadEntX. no data. with context", async () => {
      try {
        await loadEntX(ctx.getViewer(), "1", options);
        throw new Error("should have thrown");
      } catch (e) {
        expect(e.message).toMatch(/couldn't find row for value 1/);
      }
    });

    test("loadEnt. data. no context", async () => {
      const user = await createUser();
      const ent = await loadEnt(noCtxV, user.id, options);
      expect(ent).not.toBeNull();
      expect(ent).toBeInstanceOf(User);
    });

    test("loadEnt. data. with context", async () => {
      const user = await createUser();
      const ent = await loadEnt(ctx.getViewer(), user.id, options);
      expect(ent).not.toBeNull();
      expect(ent).toBeInstanceOf(User);
    });

    test("loadEntX. data. no context", async () => {
      const user = await createUser();
      const ent = await loadEntX(noCtxV, user.id, options);
      expect(ent).toBeInstanceOf(User);
    });

    test("loadEntX. data. with context", async () => {
      const user = await createUser();
      const ent = await loadEntX(ctx.getViewer(), user.id, options);
      expect(ent).toBeInstanceOf(User);
    });

    class User2 extends BaseEnt {
      accountID: string;
      nodeType = "User2";
      getPrivacyPolicy() {
        return {
          rules: [AllowIfViewerRule, AlwaysDenyRule],
        };
      }
    }

    class User2Schema implements BuilderSchema<User2> {
      ent = User2;
      fields: FieldMap = {
        id: UUIDType(),
        foo: StringType(),
      };
    }

    function getBuilder() {
      const action = new SimpleAction(
        viewer,
        new User2Schema(),
        new Map([
          ["id", "{id}"],
          ["foo", "bar"],
        ]),
        WriteOperation.Insert,
        null,
      );
      action.viewerForEntLoad = (data: Data) => {
        return new IDViewer(data.id);
      };
      return action.builder;
    }

    const user2Options: LoadEntOptions<User2> = {
      ent: User2,
      fields: ["id", "foo"],
      tableName: "user2s",
      loaderFactory: new ObjectLoaderFactory({
        fields: ["id", "foo"],
        tableName: "user2s",
        key: "id",
      }),
    };

    test("loadEntX. not visible privacy. with context", async () => {
      const b = getBuilder();
      await b.saveX();
      const user = await b.editedEntX();
      try {
        await loadEntX(ctx.getViewer(), user.id, user2Options);

        throw new Error("should have thrown");
      } catch (e) {
        expect(e.message).toMatch(
          /ent (.+) of type User2 is not visible for privacy reasons/,
        );
      }
    });

    test("loadEntX. not visible privacy. no context", async () => {
      const b = getBuilder();
      await b.saveX();
      const user = await b.editedEntX();
      try {
        await loadEntX(noCtxV, user.id, user2Options);
        throw new Error("should have thrown");
      } catch (e) {
        expect(e.message).toMatch(
          /ent (.+) of type User2 is not visible for privacy reasons/,
        );
      }
    });

    test("retrieving garbage", async () => {
      const b = getBuilder();
      await b.saveX();
      const user = await b.editedEntX();
      try {
        await loadEntX(noCtxV, user.id, {
          ent: User2,
          // this would throw in SQL land since columns don't exist but we're more flexible with parse_sql so need to handle this
          fields: ["firstName", "lastName"],
          tableName: "user2s",
          loaderFactory: new ObjectLoaderFactory({
            fields: ["id", "foo"],
            tableName: "user2s",
            key: "id",
          }),
        });
      } catch (e) {
        expect(e.message).toMatch(
          /ent (.+) of type User2 is not visible for privacy reasons/,
        );
      }
    });

    test("loadEntViaKey", async () => {
      await createUser();
      const opts2: LoadEntOptions<User> = {
        ...options,
        loaderFactory: new ObjectLoaderFactory({
          fields,
          tableName,
          key: "foo",
        })
          // @ts-ignore
          .addToPrime(options.loaderFactory),
      };

      setLogLevels(["query"]);

      const ml = new MockLogs();
      ml.mock();
      const ent = await loadEntViaKey(ctx.getViewer(), "bar", opts2);
      expect(ent).not.toBeNull();
      if (!ent) {
        throw new Error("impossible");
      }
      expect(ent.data.foo).toBe("bar");

      expect(ent.id).not.toBe("bar");
      expect(validatev4(ent.id.toString())).toBe(true);

      // cache primed this one so no subsequent fetch
      await loadEntX(ctx.getViewer(), ent.id, options);

      expect(ml.logs.length).toBe(1);
      ml.clear();
    });

    test("loadEntXViaKey", async () => {
      await createUser();
      const opts2: LoadEntOptions<User> = {
        ...options,
        loaderFactory: new ObjectLoaderFactory({
          fields,
          tableName,
          key: "foo",
        })
          // @ts-ignore
          .addToPrime(options.loaderFactory),
      };

      setLogLevels(["query"]);

      const ml = new MockLogs();
      ml.mock();
      const ent = await loadEntXViaKey(ctx.getViewer(), "bar", opts2);
      expect(ent.data.foo).toBe("bar");

      expect(ent.id).not.toBe("bar");
      expect(validatev4(ent.id.toString())).toBe(true);

      // cache primed this one so no subsequent fetch
      await loadEntX(ctx.getViewer(), ent.id, options);

      expect(ml.logs.length).toBe(1);
      ml.clear();
    });

    test("loadEntViaKey. no prime", async () => {
      await createUser();
      const opts2: LoadEntOptions<User> = {
        ...options,
        loaderFactory: new ObjectLoaderFactory({
          fields,
          tableName,
          key: "foo",
        }),
      };

      setLogLevels("query");
      const ml = new MockLogs();
      ml.mock();

      const ent = await loadEntViaKey(ctx.getViewer(), "bar", opts2);

      expect(ent).not.toBeNull();
      if (!ent) {
        throw new Error("impossible");
      }
      expect(ent.data.foo).toBe("bar");

      expect(ent.id).not.toBe("bar");
      expect(validatev4(ent.id.toString())).toBe(true);

      await loadEntX(ctx.getViewer(), ent.id, options);

      expect(ml.logs.length).toBe(2);
      ml.clear();
    });

    test("loadEntXViaKey. no prime", async () => {
      await createUser();
      const opts2: LoadEntOptions<User> = {
        ...options,
        loaderFactory: new ObjectLoaderFactory({
          fields,
          tableName,
          key: "foo",
        }),
      };

      setLogLevels("query");
      const ml = new MockLogs();
      ml.mock();

      const ent = await loadEntXViaKey(ctx.getViewer(), "bar", opts2);

      expect(ent.data.foo).toBe("bar");

      expect(ent.id).not.toBe("bar");
      expect(validatev4(ent.id.toString())).toBe(true);

      await loadEntX(ctx.getViewer(), ent.id, options);

      expect(ml.logs.length).toBe(2);
      ml.clear();
    });
  });
}

function getTables() {
  return [
    // all these different tables used
    assoc_edge_config_table(),
    table("users", text("id", { primaryKey: true }), text("foo")),
    table("user2s", text("id", { primaryKey: true }), text("foo")),
    assoc_edge_table("edge1_table"),
    assoc_edge_table("edge2_table"),
    assoc_edge_table("edge3_table"),
    assoc_edge_table("edge_table"),
  ];
}

let postgresTDB: TempDB;
let sqliteTDB: TempDB;

function getTempDB() {
  if (Dialect.Postgres === DB.getDialect()) {
    return postgresTDB;
  }

  return sqliteTDB;
}

describe("postgres", () => {
  postgresTDB = new TempDB(Dialect.Postgres, getTables);
  commonTests();

  beforeAll(async () => {
    await postgresTDB.beforeAll();
  });

  afterAll(async () => {
    await postgresTDB.afterAll();
  });

  beforeAll(async () => {
    await createEdgeRows(["edge"]);
  });
});

describe("sqlite", () => {
  sqliteTDB = setupSqlite(`sqlite:///ent_test.db`, getTables);

  beforeEach(async () => {
    await createEdgeRows(["edge"]);
  });
  commonTests();
});
