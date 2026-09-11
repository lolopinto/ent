import { randomUUID } from "crypto";
import DB, { Dialect } from "./db";
import { withTransactionScope } from "./transaction";
import { Allow, Deny } from "./base";
import { AlwaysDenyPrivacyPolicy } from "./privacy";
import { applyPrivacyPolicyForRow, loadEntX } from "./ent";
import { ObjectLoaderFactory } from "./loaders";
import { CustomEdgeQueryBase } from "./query/custom_query";
import { IntegerType } from "../schema";
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
import { WriteOperation } from "../action/action";
class ConsumerAccount extends BaseEnt {
  nodeType = "ConsumerAccount";
}
const schema = getBuilderSchemaFromFields(
  { balance: IntegerType() },
  ConsumerAccount,
);
const loader = {
  tableName: "consumer_accounts",
  fields: getDbFields(schema),
  key: "id",
};
const options = {
  ...loader,
  ent: ConsumerAccount,
  loaderFactory: new ObjectLoaderFactory(loader),
};
const context = new TestContext();
const viewer = context.getViewer();
class GuardedEdit extends SimpleAction<ConsumerAccount> {
  requiresTransactionScope() {
    return true;
  }
}
const create = () =>
  new SimpleAction(
    viewer,
    schema,
    new Map([["balance", 100]]),
    WriteOperation.Insert,
    null,
  ).saveX();
const load = (id: any) => loadEntX(viewer, id, options);
const edit = (ent: ConsumerAccount, balance: number) =>
  new GuardedEdit(
    viewer,
    schema,
    new Map([["balance", balance]]),
    WriteOperation.Edit,
    ent,
  );
class AccountQuery extends CustomEdgeQueryBase<
  ConsumerAccount,
  ConsumerAccount
> {
  async sourceEnt(id: any) {
    return load(id);
  }
  getPrivacyPolicy() {
    return {
      rules: [
        {
          async apply(_viewer: any, ent: any) {
            return ent.data.balance === 100 ? Allow() : Deny();
          },
        },
      ],
    };
  }
}

function accountQuery(src: any) {
  return new AccountQuery(viewer, {
    src,
    loadEntOptions: options,
    groupCol: "id",
    name: "consumer-source",
  });
}
describe("safe consumer provenance outcomes", () => {
  setupPostgres(() => [
    getSchemaTable(schema, Dialect.Postgres),
    assoc_edge_config_table(),
    assoc_edge_table("provenance_edges"),
  ]);
  beforeEach(() => context.cache.reset());
  describe.each([
    "root",
    "child",
    "privacy-skipped child",
  ] as const)("%s result without row writes", (position) => {
    const graph = (current: ConsumerAccount) => {
      const noWrite = new GuardedEdit(
        viewer,
        schema,
        new Map(),
        WriteOperation.Edit,
        current,
      );
      if (position === "privacy-skipped child") {
        Object.assign(noWrite, {
          getPrivacyPolicy: () => AlwaysDenyPrivacyPolicy,
          __failPrivacySilently: () => true,
        });
      }
      const writer = edit(current, 80);
      const parent = position === "root" ? noWrite : writer;
      const child = position === "root" ? writer : noWrite;
      parent.getTriggers = () => [{ changeset: () => child.changeset() }];
      return { parent, noWrite };
    };

    test("result reloads after graph writes before it becomes a fresh input", async () => {
      const owner = await create();
      await withTransactionScope(async () => {
        const { parent, noWrite } = graph(await load(owner.id));
        const result = await parent.saveX();
        const snapshot =
          position === "root" ? result : await noWrite.editedEntX();
        expect(snapshot.data.balance).toBe(80);
        await edit(snapshot, snapshot.data.balance - 30).saveX();
      });
      expect((await load(owner.id)).data.balance).toBe(50);
    });

    test("composition remains valid when the next action reloads", async () => {
      const owner = await create();
      await withTransactionScope(async () => {
        const { parent } = graph(await load(owner.id));
        await parent.saveX();
        const fresh = await load(owner.id);
        expect(fresh.data.balance).toBe(80);
        await edit(fresh, fresh.data.balance - 30).saveX();
      });
      expect((await load(owner.id)).data.balance).toBe(50);
    });
  });
  describe.each([
    "SELECT * FROM consumer_accounts WHERE id = $1",
    "UPDATE consumer_accounts SET balance = balance WHERE id = $1 RETURNING *",
  ])("%s", (sql) => {
    test.each([
      "query",
      "queryAll",
      "exec",
    ] as const)("%s stale rows cannot feed later scoped writes", async (method) => {
      const owner = await create();
      let caught: unknown;
      let outer: unknown;
      try {
        await withTransactionScope(async (tx) => {
          const oldRow = (await tx[method](sql, [owner.id])).rows[0];
          await edit(await load(owner.id), 80).saveX();
          try {
            const stale = await applyPrivacyPolicyForRow(
              viewer,
              options,
              oldRow,
            );
            await edit(stale!, stale!.data.balance - 30).saveX();
          } catch (error) {
            caught = error;
          }
        });
      } catch (error) {
        outer = error;
      }
      expect(caught).toBeInstanceOf(Error);
      expect(outer).toBe(caught);
      expect((await load(owner.id)).data.balance).toBe(100);
    });
  });
  test.each([
    "query",
    "queryAll",
    "exec",
  ] as const)("%s fresh rows materialize and support sequential scoped saves", async (method) => {
    const owner = await create();
    await withTransactionScope(async (tx) => {
      const firstRow = (
        await tx[method]("SELECT * FROM consumer_accounts WHERE id = $1", [
          owner.id,
        ])
      ).rows[0];
      const first = await applyPrivacyPolicyForRow(viewer, options, firstRow);
      await edit(first!, first!.data.balance - 20).saveX();
      const freshRow = (
        await tx[method]("SELECT * FROM consumer_accounts WHERE id = $1", [
          owner.id,
        ])
      ).rows[0];
      const fresh = await applyPrivacyPolicyForRow(viewer, options, freshRow);
      await edit(fresh!, fresh!.data.balance - 30).saveX();
    });
    expect((await load(owner.id)).data.balance).toBe(50);
  });
  test.each([
    "supplied",
    "sourceEnt fallback",
  ] as const)("%s stale query source rejects and poisons the scope when caught", async (mode) => {
    const owner = await create();
    let caught: unknown;
    let outer: unknown;
    try {
      await withTransactionScope(async () => {
        const stale = await load(owner.id);
        await edit(stale, 80).saveX();
        try {
          const query = accountQuery(mode === "supplied" ? stale : owner.id);
          if (mode === "sourceEnt fallback") {
            query.sourceEnt = async () => stale;
          }
          await query.queryRawCount();
        } catch (error) {
          caught = error;
        }
      });
    } catch (error) {
      outer = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(outer).toBe(caught);
    expect((await load(owner.id)).data.balance).toBe(100);
  });
  test("fresh Ent and ID query sources keep correct privacy behavior after a scoped save", async () => {
    const owner = await create();
    await withTransactionScope(async () => {
      const first = await load(owner.id);
      expect(await accountQuery(first).queryRawCount()).toBe(1);
      await edit(first, 80).saveX();
      expect(await accountQuery(await load(owner.id)).queryRawCount()).toBe(0);
      expect(await accountQuery(owner.id).queryRawCount()).toBe(0);
    });
    expect((await load(owner.id)).data.balance).toBe(80);
  });
  test.each([
    "row write",
    "no-op",
    "edge-only",
    "no-op with writing child",
    "edge-only with writing child",
  ])("immediate %s result can use itself as an edge-query privacy source", async (mode) => {
    const owner = await create();
    const originalPrivacy = ConsumerAccount.prototype.getPrivacyPolicy;
    const edgeType = randomUUID();
    if (mode.startsWith("edge-only")) {
      await DB.getInstance()
        .getPool()
        .query(
          "INSERT INTO assoc_edge_config (edge_type, edge_name, symmetric_edge, edge_table, created_at, updated_at) VALUES ($1, 'ProvenancePeers', false, 'provenance_edges', now(), now())",
          [edgeType],
        );
    }
    try {
      await withTransactionScope(async () => {
        const existing = await load(owner.id);
        ConsumerAccount.prototype.getPrivacyPolicy = function () {
          return {
            rules: [
              {
                async apply(_v: any, ent: any) {
                  await accountQuery(ent).queryRawCount();
                  return Allow();
                },
              },
            ],
          };
        };
        const action =
          mode === "row write"
            ? edit(existing, 80)
            : new GuardedEdit(
                viewer,
                schema,
                new Map(),
                WriteOperation.Edit,
                existing,
              );
        if (mode.startsWith("edge-only")) {
          action.builder.orchestrator.addOutboundEdge(
            owner.id,
            edgeType,
            "ConsumerAccount",
          );
        }
        if (mode.endsWith("writing child")) {
          action;
          action.getTriggers = () => [
            {
              changeset: () => edit(existing, 80).changeset(),
            },
          ];
        }
        const result = await action.saveX();
        expect(result.data.balance).toBe(
          mode === "row write" || mode.endsWith("writing child") ? 80 : 100,
        );
      });
    } finally {
      ConsumerAccount.prototype.getPrivacyPolicy = originalPrivacy;
    }
    expect((await load(owner.id)).data.balance).toBe(
      mode === "row write" || mode.endsWith("writing child") ? 80 : 100,
    );
  });
  test.each([
    "action privacy",
    "field privacy",
    "unsafe getter",
  ])("proposed insert Ent supports %s inside its preparation generation", async (kind) => {
    let calls = 0;
    const policy = {
      rules: [
        {
          async apply(_viewer: any, ent: any) {
            calls++;
            expect(ent).toBeInstanceOf(ConsumerAccount);
            expect(await accountQuery(ent).queryRawCount()).toBe(0);
            return Allow();
          },
        },
      ],
    };
    const insertSchema = getBuilderSchemaFromFields(
      {
        balance: IntegerType(
          kind === "field privacy" ? { editPrivacyPolicy: policy } : {},
        ),
      },
      ConsumerAccount,
    );
    await withTransactionScope(async () => {
      const action = new GuardedEdit(
        viewer,
        insertSchema,
        new Map([["balance", 100]]),
        WriteOperation.Insert,
        null,
      );
      if (kind === "action privacy") {
        action.getPrivacyPolicy = () => policy;
      }
      if (kind === "unsafe getter") {
        const proposed =
          await action.builder.orchestrator.getPossibleUnsafeEntForPrivacy();
        expect(await accountQuery(proposed).queryRawCount()).toBe(0);
      }
      const result = await action.saveX();
      expect(result.data.balance).toBe(100);
    });
    if (kind !== "unsafe getter") {
      expect(calls).toBe(1);
    }
  });
  test("retained proposed Ent cannot authorize a query after another scoped save", async () => {
    const owner = await create();
    await expect(
      withTransactionScope(async () => {
        const action = new GuardedEdit(
          viewer,
          schema,
          new Map([["balance", 100]]),
          WriteOperation.Insert,
          null,
        );
        const proposed =
          await action.builder.orchestrator.getPossibleUnsafeEntForPrivacy();
        await edit(await load(owner.id), 80).saveX();
        await expect(accountQuery(proposed).queryRawCount()).rejects.toThrow(
          "reload existingEnt",
        );
      }),
    ).rejects.toThrow("reload existingEnt");
    expect((await load(owner.id)).data.balance).toBe(100);
  });
  test.each([
    "query",
    "queryAll",
    "exec",
  ] as const)("%s retained rows cannot cross scopes", async (method) => {
    const owner = await create();
    const row = await withTransactionScope(
      async (tx) =>
        (
          await tx[method]("SELECT * FROM consumer_accounts WHERE id=$1", [
            owner.id,
          ])
        ).rows[0],
    );
    await expect(
      withTransactionScope(async () => {
        const old = await applyPrivacyPolicyForRow(viewer, options, row);
        await expect(edit(old!, 70).saveX()).rejects.toThrow(
          "reload existingEnt",
        );
      }),
    ).rejects.toThrow("reload existingEnt");
    expect((await load(owner.id)).data.balance).toBe(100);
  });
  test.each([
    "query",
    "queryAll",
    "exec",
  ] as const)("%s pending rows cannot complete in another generation", async (method) => {
    const owner = await create();
    let start!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => {
      start = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const db = DB.getInstance();
    const acquire = db.getNewClient.bind(db);
    const spy = jest
      .spyOn(db, "getNewClient")
      .mockImplementationOnce(async () => {
        const client = await acquire();
        const adapterMethod = method === "exec" ? "exec" : "query";
        const query = client[adapterMethod].bind(client);
        client[adapterMethod] = async (sql, values) => {
          const result = await query(sql, values);
          if (sql.includes("paused_provenance")) {
            start();
            await gate;
          }
          return result;
        };
        return client;
      });
    try {
      await expect(
        withTransactionScope(async (tx) => {
          const pending = tx[method](
            "SELECT * FROM consumer_accounts WHERE id=$1 /* paused_provenance */",
            [owner.id],
          );
          const checked = expect(pending).rejects.toThrow(
            "cannot cross transaction generations",
          );
          await started;
          try {
            await edit(await load(owner.id), 80).saveX();
          } finally {
            release();
          }
          await checked;
        }),
      ).rejects.toThrow("cannot cross transaction generations");
    } finally {
      spy.mockRestore();
      release();
    }
    expect((await load(owner.id)).data.balance).toBe(100);
  });
});
