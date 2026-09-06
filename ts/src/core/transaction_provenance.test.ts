import DB, { Dialect } from "./db";
import { withTransaction } from "./transaction";
import { Allow, Deny } from "./base";
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
import { setupPostgres, getSchemaTable } from "../testutils/db/temp_db";
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
  requiresTransaction() {
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
  setupPostgres(() => [getSchemaTable(schema, Dialect.Postgres)]);
  beforeEach(() => context.cache.reset());
  describe.each([
    "SELECT * FROM consumer_accounts WHERE id = $1",
    "UPDATE consumer_accounts SET balance = balance WHERE id = $1 RETURNING *",
  ])("%s", (sql) => {
    test.each(["query", "queryAll", "exec"] as const)(
      "%s stale rows cannot feed later guarded writes",
      async (method) => {
        const owner = await create();
        let caught: unknown;
        let outer: unknown;
        try {
          await withTransaction(async (tx) => {
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
      },
    );
  });
  test.each(["query", "queryAll", "exec"] as const)(
    "%s fresh rows materialize and support sequential guarded saves",
    async (method) => {
      const owner = await create();
      await withTransaction(async (tx) => {
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
    },
  );
  test.each(["supplied", "sourceEnt fallback"] as const)(
    "%s stale query source rejects and poisons the scope when caught",
    async (mode) => {
      const owner = await create();
      let caught: unknown;
      let outer: unknown;
      try {
        await withTransaction(async () => {
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
    },
  );
  test("fresh Ent and ID query sources keep correct privacy behavior after a guarded save", async () => {
    const owner = await create();
    await withTransaction(async () => {
      const first = await load(owner.id);
      expect(await accountQuery(first).queryRawCount()).toBe(1);
      await edit(first, 80).saveX();
      expect(await accountQuery(await load(owner.id)).queryRawCount()).toBe(0);
      expect(await accountQuery(owner.id).queryRawCount()).toBe(0);
    });
    expect((await load(owner.id)).data.balance).toBe(80);
  });
  test("immediate action result can use itself as an edge-query privacy source", async () => {
    const owner = await create();
    const originalPrivacy = ConsumerAccount.prototype.getPrivacyPolicy;
    try {
      await withTransaction(async () => {
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
        const result = await edit(existing, 80).saveX();
        expect(result.data.balance).toBe(80);
      });
    } finally {
      ConsumerAccount.prototype.getPrivacyPolicy = originalPrivacy;
    }
    expect((await load(owner.id)).data.balance).toBe(80);
  });
  test.each(["action privacy", "field privacy", "unsafe getter"])(
    "proposed insert Ent supports %s inside its preparation generation",
    async (kind) => {
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
      await withTransaction(async () => {
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
    },
  );
  test("retained proposed Ent cannot authorize a query after another guarded save", async () => {
    const owner = await create();
    await expect(
      withTransaction(async () => {
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
  test.each(["query", "queryAll", "exec"] as const)(
    "%s retained rows cannot cross scopes",
    async (method) => {
      const owner = await create();
      const row = await withTransaction(
        async (tx) =>
          (
            await tx[method]("SELECT * FROM consumer_accounts WHERE id=$1", [
              owner.id,
            ])
          ).rows[0],
      );
      await expect(
        withTransaction(async () => {
          const old = await applyPrivacyPolicyForRow(viewer, options, row);
          await expect(edit(old!, 70).saveX()).rejects.toThrow(
            "reload existingEnt",
          );
        }),
      ).rejects.toThrow("reload existingEnt");
      expect((await load(owner.id)).data.balance).toBe(100);
    },
  );
  test.each(["query", "queryAll", "exec"] as const)(
    "%s pending rows cannot complete in another generation",
    async (method) => {
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
          const query = client.query.bind(client);
          client.query = async (sql, values) => {
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
          withTransaction(async (tx) => {
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
    },
  );
});
