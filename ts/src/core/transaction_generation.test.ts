import DB, { Dialect } from "./db";
import { withTransaction } from "./transaction";
import { Allow, Data, EdgeQueryableDataOptions, ID } from "./base";
import { Eq } from "./clause";
import {
  applyPrivacyPolicyForRow,
  AssocEdge,
  loadEntX,
  loadEnts,
  loadRow,
  loadRows,
  performRawQuery,
  getEntLoaderPrivacyConcurrencyLimit,
  setEntLoaderPrivacyConcurrencyLimit,
} from "./ent";
import { CustomClauseQuery } from "./query/custom_clause_query";
import { CustomEdgeQueryBase } from "./query/custom_query";
import { AssocEdgeQueryBase } from "./query/assoc_query";
import { IDInfo } from "./query/query";
import {
  ObjectLoaderFactory,
  QueryLoaderFactory,
  RawCountLoader,
  AssocEdgeLoaderFactory,
  AssocEdgeCountLoaderFactory,
} from "./loaders";
import { ObjectCountLoader } from "./loaders/object_loader";
import { InstrumentedDataLoader } from "./loaders/loader";
import { WriteOperation } from "../action/action";
import { BooleanType, IntegerType } from "../schema";
import {
  BaseEnt,
  SimpleAction,
  getBuilderSchemaFromFields,
  getDbFields,
} from "../testutils/builder";
import {
  setupPostgres,
  getSchemaTable,
  assoc_edge_config_table,
  assoc_edge_table,
} from "../testutils/db/temp_db";
import { TestContext } from "../testutils/context/test_context";

class GenerationAccount extends BaseEnt {
  nodeType = "GenerationAccount";
}
const schema = getBuilderSchemaFromFields(
  { balance: IntegerType(), admin: BooleanType() },
  GenerationAccount,
);
const fields = getDbFields(schema);
const loaderOptions = { tableName: "generation_accounts", fields, key: "id" };
const factory = new ObjectLoaderFactory(loaderOptions);
const options = {
  ...loaderOptions,
  ent: GenerationAccount,
  loaderFactory: factory,
};
const context = new TestContext();
const viewer = context.getViewer();
const edgeType = "10506d83-e3c0-46e8-83b6-41de7271f2ad";
const edgeFactory = new AssocEdgeLoaderFactory(edgeType, AssocEdge);
const countFactory = new AssocEdgeCountLoaderFactory(edgeType);
const expired = "cannot cross transaction generations";
const load = (id: ID) => loadEntX(viewer, id, options);

class GuardedEdit extends SimpleAction<GenerationAccount> {
  requiresTransaction() {
    return true;
  }
}
const edit = (ent: GenerationAccount, balance: number) =>
  new GuardedEdit(
    viewer,
    schema,
    new Map([["balance", balance]]),
    WriteOperation.Edit,
    ent,
  );
const makeQuery = (id: ID) =>
  new CustomClauseQuery(viewer, {
    loadEntOptions: options,
    clause: Eq("id", id),
    name: "generation-account",
  });
class AccountQuery extends CustomEdgeQueryBase<
  GenerationAccount,
  GenerationAccount
> {
  async sourceEnt() {
    return null;
  }
}
class AccountEdges extends AssocEdgeQueryBase<
  GenerationAccount,
  GenerationAccount,
  AssocEdge
> {
  async sourceEnt() {
    return null;
  }
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("transaction read generations", () => {
  setupPostgres(() => [
    getSchemaTable(schema, Dialect.Postgres),
    assoc_edge_config_table(),
    assoc_edge_table("generation_edges"),
  ]);
  beforeEach(async () => {
    context.cache.reset();
    await DB.getInstance()
      .getPool()
      .query(
        "INSERT INTO assoc_edge_config (edge_type, edge_name, edge_table, symmetric_edge, created_at, updated_at) VALUES ($1, 'generation edge', 'generation_edges', false, now(), now()) ON CONFLICT DO NOTHING",
        [edgeType],
      );
  });
  const create = () =>
    new SimpleAction(
      viewer,
      schema,
      new Map<string, any>([
        ["balance", 100],
        ["admin", true],
      ]),
      WriteOperation.Insert,
      null,
    ).saveX();

  test.each([
    "queryEnts",
    "queryAllEnts",
    "queryEdges",
    "queryAllEdges",
    "queryIDs",
    "queryAllIDs",
    "queryCount",
    "queryAllCount",
    "queryRawCount",
  ] as const)(
    "retained clause query %s expires after a guarded save",
    async (method) => {
      const owner = await create();
      await expect(
        withTransaction(async () => {
          const query = makeQuery(owner.id);
          const first = await query[method]();
          expect(await query[method]()).toEqual(first);
          await edit(await load(owner.id), 80).saveX();
          await expect(query[method]()).rejects.toThrow(expired);
        }),
      ).rejects.toThrow(expired);
      expect((await load(owner.id)).data.balance).toBe(100);
    },
  );

  test("rebuilding the query after each save computes 100 minus 20 minus 30 as 50", async () => {
    const owner = await create();
    await withTransaction(async () => {
      const first = (await makeQuery(owner.id).queryEnts())[0];
      await edit(first, first.data.balance - 20).saveX();
      const second = (await makeQuery(owner.id).queryEnts())[0];
      expect(second.data.balance).toBe(80);
      await edit(second, second.data.balance - 30).saveX();
    });
    expect((await load(owner.id)).data.balance).toBe(50);
  });

  test.each([
    "queryEnts",
    "queryAllEnts",
    "queryCount",
    "queryRawCount",
    "queryAllRawCount",
  ] as const)(
    "custom edge query %s follows the same generation boundary",
    async (method) => {
      const owner = await create();
      await expect(
        withTransaction(async () => {
          const query = new AccountQuery(viewer, {
            src: owner.id,
            loadEntOptions: options,
            groupCol: "id",
            name: "generation-custom-edge",
          });
          await query[method]();
          await edit(await load(owner.id), 80).saveX();
          await query[method]();
        }),
      ).rejects.toThrow(expired);
      expect((await load(owner.id)).data.balance).toBe(100);
    },
  );

  test.each([
    "queryEnts",
    "queryAllEnts",
    "queryRawCount",
    "queryAllRawCount",
    "queryID2",
    "queryAllID2",
  ] as const)(
    "association query %s follows the same generation boundary",
    async (method) => {
      const owner = await create();
      await expect(
        withTransaction(async () => {
          const query = new AccountEdges(
            viewer,
            owner.id,
            countFactory,
            edgeFactory,
            options,
          );
          await query[method](owner.id);
          await edit(await load(owner.id), 80).saveX();
          await query[method](owner.id);
        }),
      ).rejects.toThrow(expired);
    },
  );

  describe.each(["raw rows", "Ent materialization"] as const)(
    "pending query after %s",
    (phase) => {
      test.each(
        phase === "Ent materialization"
          ? (["queryEnts", "queryAllEnts"] as const)
          : ([
              "queryEnts",
              "queryAllEnts",
              "queryIDs",
              "queryAllIDs",
              "queryCount",
              "queryAllCount",
            ] as const),
      )("%s cannot return an older generation", async (method) => {
        const owner = await create();
        const started = deferred();
        const finish = deferred();
        class PausedQuery extends CustomClauseQuery<GenerationAccount> {
          protected async loadRawData(
            infos: IDInfo[],
            opts: EdgeQueryableDataOptions,
          ) {
            await super.loadRawData(infos, opts);
            if (phase === "raw rows") {
              started.resolve();
              await finish.promise;
            }
          }
          protected async loadEntsFromEdges(id: ID, rows: Data[]) {
            if (phase === "Ent materialization") {
              started.resolve();
              await finish.promise;
            }
            return super.loadEntsFromEdges(id, rows);
          }
        }
        await expect(
          withTransaction(async () => {
            const query = new PausedQuery(viewer, {
              loadEntOptions: options,
              clause: Eq("id", owner.id),
              name: "paused-generation",
            });
            const pending = query[method]();
            await started.promise;
            try {
              await edit(await load(owner.id), 80).saveX();
            } finally {
              finish.resolve();
            }
            await expect(pending).rejects.toThrow(expired);
          }),
        ).rejects.toThrow(expired);
        expect((await load(owner.id)).data.balance).toBe(100);
      });
    },
  );

  const loaderKinds = [
    "object id",
    "object ids",
    "object clause",
    "object clauses",
    "object count",
    "object counts",
    "query",
    "query direct",
    "raw count",
    "association",
    "association direct",
    "association count",
  ] as const;
  const reader = (
    kind: (typeof loaderKinds)[number],
    id: ID,
    cached: boolean,
  ) => {
    const ctx = cached ? context : undefined;
    const object = factory.createLoader(ctx);
    const count = new ObjectCountLoader(loaderOptions, ctx);
    const query = new QueryLoaderFactory({ ...loaderOptions, groupCol: "id" });
    switch (kind) {
      case "object id":
        return () => object.load(id);
      case "object ids":
        return () => object.loadMany([id]);
      case "object clause":
        return () => object.load(Eq("id", id));
      case "object clauses":
        return () => object.loadMany([Eq("id", id)]);
      case "object count":
        return () => count.load(Eq("id", id));
      case "object counts":
        return () => count.loadMany([Eq("id", id)]);
      case "query": {
        const l = query.createLoader(ctx);
        return () => l.load(id);
      }
      case "query direct": {
        const l = query.createConfigurableLoader(
          { clause: Eq("admin", true) },
          ctx,
        );
        return () => l.load(id);
      }
      case "raw count": {
        const l = new RawCountLoader(
          { tableName: loaderOptions.tableName, groupCol: "id" },
          ctx,
        );
        return () => l.load(id);
      }
      case "association": {
        const l = edgeFactory.createLoader(ctx);
        return () => l.load(id);
      }
      case "association direct": {
        const l = edgeFactory.createConfigurableLoader(
          { clause: Eq("id2", id) },
          ctx,
        );
        return () => l.load(id);
      }
      case "association count": {
        const l = countFactory.createLoader(ctx);
        return () => l.load(id);
      }
    }
  };
  describe.each([true, false])("loaders with request context %s", (cached) => {
    test.each(loaderKinds)(
      "retained %s loader expires after a guarded save",
      async (kind) => {
        const owner = await create();
        await expect(
          withTransaction(async () => {
            const read = reader(kind, owner.id, cached);
            const first = await read();
            expect(await read()).toEqual(first);
            await edit(await load(owner.id), 80).saveX();
            await read();
          }),
        ).rejects.toThrow(expired);
        expect((await load(owner.id)).data.balance).toBe(100);
      },
    );
  });

  test.each(["load", "loadMany"] as const)(
    "pending numeric DataLoader %s cannot cross a guarded write",
    async (method) => {
      const owner = await create();
      const started = deferred();
      const finish = deferred();
      await expect(
        withTransaction(async () => {
          const loader = new InstrumentedDataLoader<ID, number>(
            "pending-balance",
            async (ids) => {
              const rows = await loadRows({
                ...loaderOptions,
                clause: Eq("id", owner.id),
              });
              started.resolve();
              await finish.promise;
              return ids.map(() => rows[0].balance);
            },
            {},
          );
          const pending =
            method === "load"
              ? loader.load(owner.id)
              : loader.loadMany([owner.id]);
          await started.promise;
          try {
            await edit(await load(owner.id), 80).saveX();
          } finally {
            finish.resolve();
          }
          await expect(pending).rejects.toThrow(expired);
        }),
      ).rejects.toThrow(expired);
      expect((await load(owner.id)).data.balance).toBe(100);
    },
  );

  test.each([true, false])(
    "raw rows retain their original provenance when loaded inside scope %s",
    async (scoped) => {
      const owner = await create();
      const readRows = () =>
        loadRows({ ...loaderOptions, clause: Eq("id", owner.id) });
      const outside = scoped ? undefined : await readRows();
      await expect(
        withTransaction(async () => {
          const rows = outside ?? (await readRows());
          await edit(await load(owner.id), 80).saveX();
          const stale = await applyPrivacyPolicyForRow(
            viewer,
            options,
            rows[0],
          );
          expect(stale!.data.balance).toBe(100);
          await edit(stale!, 70).saveX();
        }),
      ).rejects.toThrow("reload existingEnt");
      expect((await load(owner.id)).data.balance).toBe(100);
    },
  );

  test.each(["row", "rows", "raw"] as const)(
    "pending primitive %s reads reject before returning or priming stale data",
    async (kind) => {
      const owner = await create();
      const started = deferred();
      const finish = deferred();
      await expect(
        withTransaction(async () => {
          const pool = DB.getInstance().getPool();
          const method = kind === "row" ? "query" : "queryAll";
          const query = pool[method].bind(pool);
          let paused = false;
          const spy = jest
            .spyOn(pool, method)
            .mockImplementation(async (sql, values) => {
              const result = await query(sql, values);
              if (!paused) {
                paused = true;
                started.resolve();
                await finish.promise;
              }
              return result;
            });
          try {
            const opts = {
              ...loaderOptions,
              clause: Eq("id", owner.id),
              context,
            };
            const pending =
              kind === "row"
                ? loadRow(opts)
                : kind === "rows"
                ? loadRows(opts)
                : performRawQuery(
                    "SELECT * FROM generation_accounts WHERE id = $1",
                    [owner.id],
                  );
            await started.promise;
            try {
              await edit(await load(owner.id), 80).saveX();
            } finally {
              finish.resolve();
            }
            await expect(pending).rejects.toThrow(expired);
          } finally {
            spy.mockRestore();
          }
        }),
      ).rejects.toThrow(expired);
      expect((await load(owner.id)).data.balance).toBe(100);
    },
  );

  test("fresh association readers work after guarded saves retire metadata loaders", async () => {
    const owner = await create();
    await withTransaction(async () => {
      expect(await countFactory.createLoader(context).load(owner.id)).toBe(0);
      await edit(await load(owner.id), 80).saveX();
      expect(await countFactory.createLoader(context).load(owner.id)).toBe(0);
      expect(await edgeFactory.createLoader(context).load(owner.id)).toEqual(
        [],
      );
    });
  });

  test("outside a scoped transaction query reuse retains its existing snapshot behavior", async () => {
    const owner = await create();
    const query = makeQuery(owner.id);
    expect((await query.queryEnts())[0].data.balance).toBe(100);
    await new SimpleAction(
      viewer,
      schema,
      new Map([["balance", 80]]),
      WriteOperation.Edit,
      owner,
    ).saveX();
    expect((await query.queryEnts())[0].data.balance).toBe(100);
    const fresh = new CustomClauseQuery(new TestContext().getViewer(), {
      loadEntOptions: options,
      clause: Eq("id", owner.id),
      name: "fresh-request",
    });
    expect((await fresh.queryEnts())[0].data.balance).toBe(80);
  });

  test("queued bulk privacy cannot stamp later rows with a newer generation", async () => {
    const first = await create();
    const second = await create();
    const started = deferred();
    const finish = deferred();
    const previous = getEntLoaderPrivacyConcurrencyLimit();
    setEntLoaderPrivacyConcurrencyLimit(1);
    class PausedAccount extends GenerationAccount {
      getPrivacyPolicy() {
        return {
          rules: [
            {
              apply: async (_viewer, ent) => {
                if (ent.id === first.id) {
                  started.resolve();
                  await finish.promise;
                }
                return Allow();
              },
            },
          ],
        };
      }
    }
    try {
      await expect(
        withTransaction(async () => {
          const pending = loadEnts(
            new TestContext().getViewer(),
            { ...options, ent: PausedAccount },
            first.id,
            second.id,
          );
          await started.promise;
          try {
            await edit(await load(second.id), 80).saveX();
          } finally {
            finish.resolve();
          }
          await expect(pending).rejects.toThrow(expired);
        }),
      ).rejects.toThrow(expired);
      expect((await load(second.id)).data.balance).toBe(100);
    } finally {
      setEntLoaderPrivacyConcurrencyLimit(previous);
    }
  });
});
