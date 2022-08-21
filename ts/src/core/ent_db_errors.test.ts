import {
  PrivacyPolicy,
  ID,
  Ent,
  Data,
  Viewer,
  Context,
  PrivacyResult,
  Allow,
  Skip,
  LoadEntOptions,
} from "./base";
import { LoggedOutViewer, IDViewer } from "./viewer";
import { AlwaysDenyRule, EntPrivacyError } from "./privacy";
import { loadCustomEnts, loadEnt, loadEnts, loadEntX } from "./ent";
import {
  createRowForTest,
  deleteRowsForTest,
  editRowForTest,
} from "../testutils/write";
import * as clause from "./clause";

import {
  integer,
  table,
  text,
  TempDB,
  setupSqlite,
} from "../testutils/db/temp_db";
import { MockLogs } from "../testutils/mock_log";
import DB, { Dialect } from "./db";
import { ObjectLoaderFactory } from "./loaders";
import { TestContext } from "../testutils/context/test_context";

class User implements Ent {
  id: ID;
  accountID: string;
  nodeType = "User";
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return {
      rules: [
        {
          async apply(v: Viewer, ent?: Ent): Promise<PrivacyResult> {
            if (!v.viewerID) {
              return Skip();
            }
            // can see each other if same modulus because we crazy
            const vNum = v.viewerID as number;
            if (vNum % 2 === (ent?.id as number) % 2) {
              return Allow();
            }
            return Skip();
          },
        },
        AlwaysDenyRule,
      ],
    };
  }
  constructor(public viewer: Viewer, public data: Data) {
    this.id = data["id"];
  }
}

const tbl = table(
  "users",
  integer("id", { primaryKey: true }),
  text("baz"),
  text("bar"),
  text("foo"),
);

const options: LoadEntOptions<User> = {
  tableName: "users",
  fields: ["*"],
  ent: User,
  loaderFactory: new ObjectLoaderFactory({
    tableName: "users",
    fields: ["*"],
    key: "id",
  }),
};

const invalidFieldOpts: LoadEntOptions<User> = {
  tableName: "users",
  fields: ["id", "hello"],
  ent: User,
  loaderFactory: new ObjectLoaderFactory({
    tableName: "users",
    fields: ["id", "hello"],
    key: "id",
  }),
};

describe("postgres", () => {
  const tdb = new TempDB(Dialect.Postgres, [tbl]);

  beforeAll(async () => {
    await tdb.beforeAll();
    await createAllRows();
  });

  afterAll(async () => {
    await tdb.afterAll();
  });

  commonTests();
});

describe("sqlite", () => {
  setupSqlite(`sqlite:///ent_db_errors_test.db`, () => [tbl]);

  beforeEach(async () => {
    await createAllRows();
  });

  commonTests();
});

async function createAllRows() {
  const rows = [1, 2, 3, 4, 5].map((id) => {
    return { id, baz: "baz", bar: `bar${id}`, foo: "foo" };
  });
  await Promise.all(
    rows.map((row) =>
      createRowForTest({
        tableName: "users",
        fields: row,
      }),
    ),
  );
}

const loggedOutViewer = new LoggedOutViewer();

function contextifyViewer(v?: Viewer): Viewer {
  let viewer = v || loggedOutViewer;
  new TestContext(viewer);
  return viewer;
}

function getExpectedErrorMessageOnRead() {
  const dialect = DB.getDialect();
  if (dialect === Dialect.Postgres) {
    return `column "hello" does not exist`;
  }
  return `no such column: hello`;
}

function getExpectedErrorMessageOnInsert() {
  const dialect = DB.getDialect();
  if (dialect === Dialect.Postgres) {
    return `column "hello" of relation "users" does not exist`;
  }
  return `table users has no column named hello`;
}

function getExpectedErrorMessageOnUpdate() {
  const dialect = DB.getDialect();
  if (dialect === Dialect.Postgres) {
    return `column "hello" of relation "users" does not exist`;
  }
  return `no such column: hello`;
}

function getExpectedErrorMessageOnDelete() {
  const dialect = DB.getDialect();
  if (dialect === Dialect.Postgres) {
    return `relation "hello" does not exist`;
  }
  return `no such table: hello`;
}

function commonTests() {
  test("load normal", async () => {
    const ents = await loadEnts(new IDViewer(1), options, 1);
    expect(ents.size).toBe(1);
  });

  test("load normal with context", async () => {
    const ents = await loadEnts(contextifyViewer(new IDViewer(1)), options, 1);
    expect(ents.size).toBe(1);
    expect(ents.get(1)?.viewer.context).toBeDefined();
  });

  test("query error throws for loadEnts", async () => {
    try {
      await loadEnts(new IDViewer(1), invalidFieldOpts, 1);
      throw new Error("should throw");
    } catch (err) {
      expect((err as Error).message).toBe(getExpectedErrorMessageOnRead());
    }
  });

  test("query error throws for loadEnts with context", async () => {
    try {
      await loadEnts(contextifyViewer(new IDViewer(1)), invalidFieldOpts, 1);
      throw new Error("should throw");
    } catch (err) {
      expect((err as Error).message).toBe(getExpectedErrorMessageOnRead());
    }
  });

  test("query error throws for loadEnt", async () => {
    try {
      await loadEnt(new IDViewer(1), 2, invalidFieldOpts);
      throw new Error("should throw");
    } catch (err) {
      expect((err as Error).message).toBe(getExpectedErrorMessageOnRead());
    }
  });

  test("query error throws for loadEnt with context", async () => {
    try {
      await loadEnt(contextifyViewer(new IDViewer(1)), 2, invalidFieldOpts);
      throw new Error("should throw");
    } catch (err) {
      expect((err as Error).message).toBe(getExpectedErrorMessageOnRead());
    }
  });

  test("privacy error doesn't for loadEnt", async () => {
    const ent = await loadEnt(new IDViewer(1), 2, options);
    expect(ent).toBe(null);
  });

  test("privacy error doesn't for loadEnt with context", async () => {
    const ent = await loadEnt(contextifyViewer(new IDViewer(1)), 2, options);
    expect(ent).toBe(null);
  });

  test("privacy error throws for loadEntX", async () => {
    try {
      await loadEntX(new IDViewer(1), 2, options);
      throw new Error("should throw");
    } catch (err) {
      expect(err).toBeInstanceOf(EntPrivacyError);
      expect((err as Error).message).toBe(
        "ent 2 of type User is not visible for privacy reasons",
      );
    }
  });

  test("privacy error throws for loadEntX with context", async () => {
    try {
      await loadEntX(contextifyViewer(new IDViewer(1)), 2, options);
      throw new Error("should throw");
    } catch (err) {
      expect(err).toBeInstanceOf(EntPrivacyError);
      expect((err as Error).message).toBe(
        "ent 2 of type User is not visible for privacy reasons",
      );
    }
  });

  test("query error throws for loadEntX", async () => {
    try {
      await loadEntX(new IDViewer(1), 2, invalidFieldOpts);
      throw new Error("should throw");
    } catch (err) {
      expect((err as Error).message).toBe(getExpectedErrorMessageOnRead());
    }
  });

  test("query error throws for loadEntX with context", async () => {
    try {
      await loadEntX(contextifyViewer(new IDViewer(1)), 2, invalidFieldOpts);
      throw new Error("should throw");
    } catch (err) {
      expect((err as Error).message).toBe(getExpectedErrorMessageOnRead());
    }
  });

  test("query error throws for loadCustomEnts", async () => {
    try {
      await loadCustomEnts(new IDViewer(1), options, clause.Eq("hello", "bar"));
      throw new Error("should throw");
    } catch (err) {
      expect((err as Error).message).toBe(getExpectedErrorMessageOnRead());
    }
  });

  test("query error throws for loadCustomEnts with context", async () => {
    try {
      await loadCustomEnts(
        contextifyViewer(new IDViewer(1)),
        options,
        clause.Eq("hello", "bar"),
      );
      throw new Error("should throw");
    } catch (err) {
      expect((err as Error).message).toBe(getExpectedErrorMessageOnRead());
    }
  });

  test("privacy error doesn't for loadCustomEnts", async () => {
    const ents = await loadCustomEnts(
      new IDViewer(1),
      options,
      clause.In("id", [1, 2, 3, 4, 5]),
    );
    expect(ents.length).toBe(3);
  });

  test("privacy error doesn't for loadCustomEnts with context", async () => {
    const ents = await loadCustomEnts(
      contextifyViewer(new IDViewer(1)),
      options,
      clause.In("id", [1, 2, 3, 4, 5]),
    );
    expect(ents.length).toBe(3);
  });

  test("create with db errors", async () => {
    try {
      await createRowForTest({
        tableName: "users",
        fields: {
          id: 1,
          baz: "baz",
          bar: `bar1`,
          foo: "foo",
          hello: "whaa",
        },
      });
      throw new Error("should have thrown");
    } catch (err) {
      expect((err as Error).message).toBe(getExpectedErrorMessageOnInsert());
    }
  });

  test("create with db errors with context", async () => {
    try {
      await createRowForTest({
        tableName: "users",
        fields: {
          id: 1,
          baz: "baz",
          bar: `bar1`,
          foo: "foo",
          hello: "whaa",
        },
        context: new TestContext(),
      });
      throw new Error("should have thrown");
    } catch (err) {
      expect((err as Error).message).toBe(getExpectedErrorMessageOnInsert());
    }
  });

  test("edit with db errors", async () => {
    try {
      await editRowForTest({
        tableName: "users",
        fields: {
          hello: "ss",
        },
        whereClause: clause.Eq("id", 1),
      });
      throw new Error("should have thrown");
    } catch (err) {
      expect((err as Error).message).toBe(getExpectedErrorMessageOnUpdate());
    }
  });

  test("edit with db errors with context", async () => {
    try {
      await editRowForTest({
        tableName: "users",
        fields: {
          hello: "ss",
        },
        whereClause: clause.Eq("id", 1),
        context: new TestContext(),
      });
      throw new Error("should have thrown");
    } catch (err) {
      expect((err as Error).message).toBe(getExpectedErrorMessageOnUpdate());
    }
  });

  test("delete with db errors", async () => {
    try {
      await deleteRowsForTest(
        {
          tableName: "hello",
        },
        clause.Eq("id", 1),
      );
      throw new Error("should have thrown");
    } catch (err) {
      expect((err as Error).message).toBe(getExpectedErrorMessageOnDelete());
    }
  });

  test("delete with db errors with context", async () => {
    try {
      await deleteRowsForTest(
        {
          tableName: "hello",
          context: new TestContext(),
        },
        clause.Eq("id", 1),
      );
      throw new Error("should have thrown");
    } catch (err) {
      expect((err as Error).message).toBe(getExpectedErrorMessageOnDelete());
    }
  });
}
