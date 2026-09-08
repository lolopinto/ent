import { randomUUID } from "crypto";
import DB, { Dialect } from "./db";
import { ID } from "./base";
import { Eq } from "./clause";
import {
  applyPrivacyPolicyForRow,
  AssocEdge,
  loadEntX,
  loadRow,
  loadRows,
  performRawQuery,
} from "./ent";
import { ObjectLoaderFactory } from "./loaders";
import { QueryLoaderFactory } from "./loaders/query_loader";
import { AssocEdgeLoaderFactory } from "./loaders/assoc_edge_loader";
import { withTransaction } from "../action";
import { WriteOperation } from "../action/action";
import { EntChangeset } from "../action/orchestrator";
import { IntegerType } from "../schema";
import {
  BaseEnt,
  SimpleAction,
  getBuilderSchemaFromFields,
  getDbFields,
} from "../testutils/builder";
import {
  assoc_edge_config_table,
  assoc_edge_table,
  getSchemaTable,
  setupPostgres,
} from "../testutils/db/temp_db";
import { TestContext } from "../testutils/context/test_context";

class CachedAccount extends BaseEnt {
  nodeType = "CachedAccount";
}
const schema = getBuilderSchemaFromFields(
  { balance: IntegerType() },
  CachedAccount,
);
const loader = {
  tableName: "cached_accounts",
  fields: getDbFields(schema),
  key: "id",
};
const options = {
  ...loader,
  ent: CachedAccount,
  loaderFactory: new ObjectLoaderFactory(loader),
};
const context = new TestContext();
const viewer = context.getViewer();
const load = (id: ID) => loadEntX(viewer, id, options);
const create = () =>
  new SimpleAction(
    viewer,
    schema,
    new Map([["balance", 100]]),
    WriteOperation.Insert,
    null,
  ).saveX();

setupPostgres(() => [
  getSchemaTable(schema, Dialect.Postgres),
  assoc_edge_config_table(),
  assoc_edge_table("cached_account_edges"),
]);
beforeEach(() => context.cache.reset());

describe.each([
  "exec",
  "pool exec",
  "raw changeset",
  "query",
  "queryAll",
] as const)("%s with multiple SQL commands", (method) => {
  test.each([
    "commit",
    "callback rollback",
    "caught SQL failure",
  ])("%s preserves transaction and cache behavior", async (outcome) => {
    const account = await create();
    const otherViewer = new TestContext().getViewer();
    const abort = new Error("abort after SQL commands");
    const transaction = withTransaction(async (tx) => {
      expect((await load(account.id)).data.balance).toBe(100);
      expect(
        (await loadEntX(otherViewer, account.id, options)).data.balance,
      ).toBe(100);
      const sql =
        "UPDATE cached_accounts SET balance = 80; " +
        (outcome === "caught SQL failure"
          ? "SELECT unknown_column FROM cached_accounts"
          : "UPDATE cached_accounts SET balance = 70");
      const execute = () => {
        if (method === "raw changeset") {
          const action = new SimpleAction(
            viewer,
            schema,
            new Map(),
            WriteOperation.Edit,
            account,
          );
          return EntChangeset.changesetFromQueries(action.builder, [sql])
            .executor()
            .execute();
        }
        return method === "pool exec"
          ? DB.getInstance().getPool().exec(sql)
          : tx[method](sql);
      };
      if (outcome === "caught SQL failure") {
        await expect(execute()).rejects.toHaveProperty("code", "42703");
        return;
      }
      const result = await execute();
      if (method === "query" || method === "queryAll") {
        expect(result).toEqual([
          expect.objectContaining({ rowCount: 1 }),
          expect.objectContaining({ rowCount: 1 }),
        ]);
      } else if (method !== "raw changeset") {
        expect(result).toEqual({ rows: [], rowCount: 0 });
      }
      expect((await load(account.id)).data.balance).toBe(70);
      expect(
        (await loadEntX(otherViewer, account.id, options)).data.balance,
      ).toBe(70);
      if (outcome === "callback rollback") {
        throw abort;
      }
    });
    if (outcome === "commit") {
      await transaction;
    } else if (outcome === "callback rollback") {
      await expect(transaction).rejects.toBe(abort);
    } else {
      await expect(transaction).rejects.toHaveProperty("code", "42703");
    }
    expect((await load(account.id)).data.balance).toBe(
      outcome === "commit" ? 70 : 100,
    );
  });
});

test("pending multi-command exec prevents commit", async () => {
  const account = await create();
  let pending: Promise<unknown> | undefined;
  await expect(
    withTransaction(async (tx) => {
      pending = tx
        .exec("SELECT pg_sleep(0.02); UPDATE cached_accounts SET balance = 70")
        .catch(() => undefined);
    }),
  ).rejects.toThrow("await all queries inside withTransaction");
  await pending;
  expect((await load(account.id)).data.balance).toBe(100);
});

test.each([
  ["query", 0],
  ["query", 1],
  ["queryAll", 0],
  ["queryAll", 1],
] as const)("%s result set %s retains row provenance", async (method, index) => {
  const account = await create();
  await withTransaction(async (tx) => {
    const results = await tx[method](
      "SELECT * FROM cached_accounts; SELECT * FROM cached_accounts",
    );
    if (!Array.isArray(results)) {
      throw new Error("expected multiple result sets");
    }
    const ent = await applyPrivacyPolicyForRow(
      viewer,
      options,
      results[index].rows[0],
    );
    expect(ent?.data.balance).toBe(100);
    const action = Object.assign(
      new SimpleAction(
        viewer,
        schema,
        new Map([["balance", ent!.data.balance - 20]]),
        WriteOperation.Edit,
        ent,
      ),
      { requiresTransaction: () => true },
    );
    await action.saveX();
  });
  expect((await load(account.id)).data.balance).toBe(80);
});

async function captureSQL(run: () => Promise<void>): Promise<string[]> {
  const db = DB.getInstance();
  const acquire = db.getNewClient.bind(db);
  const statements: string[] = [];
  const spy = jest
    .spyOn(db, "getNewClient")
    .mockImplementationOnce(async () => {
      const client = await acquire();
      for (const method of ["query", "exec"] as const) {
        const query = client[method].bind(client);
        client[method] = async (sql, values) => {
          statements.push(sql);
          return query(sql, values);
        };
      }
      return client;
    });
  try {
    await run();
    return statements.filter((sql) => sql.startsWith("SELECT"));
  } finally {
    spy.mockRestore();
  }
}

test.each([
  "Ent",
  "row",
  "rows",
] as const)("alternating %s reads keep both results cached", async (method) => {
  const accounts = await Promise.all([create(), create()]);
  const read = (id: ID) => {
    switch (method) {
      case "Ent":
        return load(id);
      case "row":
        return loadRow({ ...loader, clause: Eq("id", id), context });
      case "rows":
        return loadRows({ ...loader, clause: Eq("id", id), context });
    }
  };
  const sql = await captureSQL(() =>
    withTransaction(async () => {
      for (let i = 0; i < 3; i++) {
        await read(accounts[0].id);
        await read(accounts[1].id);
      }
    }),
  );
  expect(sql).toHaveLength(2);
});

test("grouped query reads preserve existing Ent and query caches", async () => {
  const accounts = await Promise.all([create(), create()]);
  const sql = await captureSQL(() =>
    withTransaction(async () => {
      await load(accounts[0].id);
      const grouped = new QueryLoaderFactory({
        ...loader,
        groupCol: "id",
      }).createLoader(context);
      for (let i = 0; i < 3; i++) {
        const rows = await Promise.all(
          accounts.map((account) => grouped.load(account.id)),
        );
        expect(rows.map((group) => group.length)).toEqual([1, 1]);
        await load(accounts[0].id);
      }
    }),
  );
  expect(sql).toHaveLength(2);
  expect(sql.some((query) => query.includes("row_number()"))).toBe(true);
});

test("grouped edge reads preserve Ent, edge, and metadata caches", async () => {
  const accounts = await Promise.all([create(), create()]);
  const edgeType = randomUUID();
  await DB.getInstance()
    .getPool()
    .query(
      "INSERT INTO assoc_edge_config (edge_type, edge_name, symmetric_edge, edge_table, created_at, updated_at) VALUES ($1, 'CachedAccountToPeers', false, 'cached_account_edges', now(), now())",
      [edgeType],
    );
  const sql = await captureSQL(() =>
    withTransaction(async () => {
      await load(accounts[0].id);
      const grouped = new AssocEdgeLoaderFactory(
        edgeType,
        AssocEdge,
      ).createLoader(context);
      for (let i = 0; i < 3; i++) {
        expect(
          await Promise.all(
            accounts.map((account) => grouped.load(account.id)),
          ),
        ).toEqual([[], []]);
        await load(accounts[0].id);
      }
    }),
  );
  expect(sql).toHaveLength(3);
  expect(sql.some((query) => query.includes("row_number()"))).toBe(true);
});

test.each([
  "query",
  "queryAll",
  "exec",
  "pool",
  "raw",
] as const)("%s SQL invalidates cached reads even for SELECT", async (method) => {
  const accounts = await Promise.all([create(), create()]);
  const sql = await captureSQL(() =>
    withTransaction(async (tx) => {
      await load(accounts[0].id);
      await load(accounts[1].id);
      if (method === "pool") {
        await DB.getInstance().getPool().query("SELECT 1");
      } else if (method === "raw") {
        await performRawQuery("SELECT 1", []);
      } else {
        await tx[method]("SELECT 1");
      }
      await load(accounts[0].id);
      await load(accounts[1].id);
    }),
  );
  expect(sql).toHaveLength(5);
});

test("ordinary action writes invalidate every viewer's scoped cache", async () => {
  const account = await create();
  const otherViewer = new TestContext().getViewer();
  await withTransaction(async () => {
    const current = await load(account.id);
    expect(
      (await loadEntX(otherViewer, account.id, options)).data.balance,
    ).toBe(100);
    await new SimpleAction(
      viewer,
      schema,
      new Map([["balance", 80]]),
      WriteOperation.Edit,
      current,
    ).saveX();
    expect((await load(account.id)).data.balance).toBe(80);
    expect(
      (await loadEntX(otherViewer, account.id, options)).data.balance,
    ).toBe(80);
  });
});
