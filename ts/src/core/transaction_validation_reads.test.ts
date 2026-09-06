import DB, { Dialect } from "./db";
import { withTransaction } from "./transaction";
import { getTransactionState } from "./transaction_context";
import { loadEntX } from "./ent";
import { Allow } from "./base";
import { ObjectLoaderFactory } from "./loaders";
import { InstrumentedDataLoader } from "./loaders/loader";
import { WriteOperation } from "../action/action";
import { BooleanType, IntegerType } from "../schema";
import { setupPostgres, getSchemaTable } from "../testutils/db/temp_db";
import {
  BaseEnt,
  getBuilderSchemaFromFields,
  SimpleAction,
  getDbFields,
} from "../testutils/builder";
import { TestContext } from "../testutils/context/test_context";

class ScopedAccount extends BaseEnt {
  nodeType = "ScopedAccount";
}
const accountSchema = getBuilderSchemaFromFields(
  {
    balance: IntegerType(),
    admin: BooleanType(),
  },
  ScopedAccount,
);
const fields = getDbFields(accountSchema);
const loaderFactory = new ObjectLoaderFactory({
  tableName: "scoped_accounts",
  fields,
  key: "id",
});
const options = {
  tableName: "scoped_accounts",
  fields,
  ent: ScopedAccount,
  loaderFactory,
};
const context = new TestContext();
const viewer = context.getViewer();
const load = (id: string) => loadEntX(viewer, id, options);

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
class GuardedEdit extends SimpleAction<ScopedAccount> {
  requiresTransaction() {
    return true;
  }
}

function independent<T extends SimpleAction<ScopedAccount>>(
  action: T,
  resource: string,
): T {
  return Object.assign(action, { getTransactionResources: () => [resource] });
}

describe.each(["valid", "validX", "validWithErrors"] as const)(
  "%s drains child setup reads",
  (method) => {
    setupPostgres(() => [getSchemaTable(accountSchema, Dialect.Postgres)]);
    beforeEach(() => context.cache.reset());
    const insert = () =>
      new SimpleAction(
        viewer,
        accountSchema,
        new Map<string, any>([
          ["balance", 100],
          ["admin", true],
        ]),
        WriteOperation.Insert,
        null,
      ).saveX();
    const edit = (ent: ScopedAccount, balance: number) =>
      new GuardedEdit(
        viewer,
        accountSchema,
        new Map([["balance", balance]]),
        WriteOperation.Edit,
        ent,
      );

    test.each([
      "SQL setup",
      "Ent privacy setup",
      "loader setup",
      "nested grandchild Ent setup",
      "late SQL failure",
    ])(
      "%s drains before closing standalone validation",
      async (mode) => {
        const records = await Promise.all([
          insert(),
          insert(),
          insert(),
          insert(),
        ]);
        const started = deferred(),
          release = deferred();
        const ordinary = new Error("correctable first child");
        const sql = mode === "SQL setup" || mode === "late SQL failure";
        const key = 1_000_000 + Math.floor(Math.random() * 1_000_000_000);
        const lock = sql ? await DB.getInstance().getNewClient() : undefined;
        if (lock) {
          await lock.query("SELECT pg_advisory_lock($1)", [key]);
        }
        let invalid = true;
        let settled = false;
        let settledBeforeRelease = false;
        let setupCompletions = 0;
        let setupError: any;
        let validationError: any;
        const observations: string[] = [];
        const transaction = withTransaction(async (tx) => {
          // Keep the earlier write after correcting validation errors. Roll it
          // back
          // if a later SQL operation fails.
          const earlier = edit(await load(records[3].id as string), 60);
          earlier.getObservers = () => [
            {
              observe: async () => {
                observations.push("committed");
              },
            },
          ];
          await earlier.saveX();
          const parent = independent(
            edit(await load(records[0].id as string), 90),
            "parent",
          );
          const bad = independent(
            edit(await load(records[1].id as string), 80),
            "bad",
          );
          bad.getValidators = () => [
            {
              validate: async () => {
                if (invalid) {
                  await started.promise;
                  return ordinary;
                }
              },
            },
          ];
          class DelayedPrivacyAccount extends ScopedAccount {
            getPrivacyPolicy() {
              return {
                rules: [
                  {
                    apply: async () => {
                      if (invalid) {
                        started.resolve();
                        await release.promise;
                      }
                      return Allow();
                    },
                  },
                ],
              };
            }
          }
          const setup = async () => {
            let ent: ScopedAccount;
            if (sql && invalid) {
              const query =
                mode === "late SQL failure"
                  ? tx.query(
                      `DO $$ BEGIN PERFORM pg_advisory_xact_lock(${key}); RAISE EXCEPTION 'late SQL setup error' USING ERRCODE = '22012'; END $$`,
                    )
                  : tx.query("SELECT pg_advisory_xact_lock($1)", [key]);
              started.resolve();
              await query;
              ent = await load(records[2].id as string);
            } else if (
              mode === "Ent privacy setup" ||
              mode === "nested grandchild Ent setup"
            ) {
              ent = await loadEntX(viewer, records[2].id, {
                ...options,
                ent: DelayedPrivacyAccount,
              });
            } else if (mode === "loader setup") {
              const reader = new InstrumentedDataLoader<string, ScopedAccount>(
                "review-delayed-setup",
                async (ids) => {
                  const ents = await Promise.all(ids.map((id) => load(id)));
                  if (invalid) {
                    started.resolve();
                    await release.promise;
                  }
                  return ents;
                },
                {},
              );
              ent = await reader.load(records[2].id as string);
            } else {
              ent = await load(records[2].id as string);
            }
            const changeset = await independent(
              edit(ent, 70),
              "slow",
            ).changeset();
            setupCompletions++;
            return changeset;
          };
          let setupOutcome: Promise<any> | undefined;
          const trigger = {
            changeset: () => {
              const pending = setup();
              setupOutcome = pending.then(
                (value) => ({ value }),
                (error) => ({ error }),
              );
              return Promise.all([bad.changeset(), pending]);
            },
          };
          if (mode === "nested grandchild Ent setup") {
            const intermediate = independent(
              new GuardedEdit(
                viewer,
                accountSchema,
                new Map<string, any>([
                  ["balance", 50],
                  ["admin", true],
                ]),
                WriteOperation.Insert,
                null,
              ),
              "intermediate",
            );
            intermediate.getTriggers = () => [trigger];
            parent.getTriggers = () => [
              { changeset: () => intermediate.changeset() },
            ];
          } else {
            parent.getTriggers = () => [trigger];
          }
          const validation = parent[method]().then(
            () => {
              settled = true;
              return undefined;
            },
            (error) => {
              settled = true;
              return error;
            },
          );
          validationError = await validation;
          const outcome = await setupOutcome!;
          setupError = outcome?.error;
          if (mode === "late SQL failure") {
            // Catch validation and SQL errors so withTransaction must enforce
            // rollback.
            return;
          }
          expect(validationError).toBe(ordinary);
          expect(outcome).toHaveProperty("value");
          expect(setupCompletions).toBe(1);
          expect(settledBeforeRelease).toBe(false);
          expect(getTransactionState()!.failed).toBe(false);
          invalid = false;
          await parent.saveX();
        });
        const transactionOutcome = transaction.then(
          (value) => ({ value }),
          (error) => ({ error }),
        );
        try {
          await started.promise;
          // Release this gate outside validation so waiting for reads cannot
          // deadlock.
          await new Promise<void>((resolve) => setImmediate(resolve));
          settledBeforeRelease = settled;
          release.resolve();
          if (lock) {
            await lock.query("SELECT pg_advisory_unlock($1)", [key]);
          }
          const result = await transactionOutcome;
          if (mode === "late SQL failure") {
            expect(validationError).toBe(ordinary);
            expect(setupError?.code).toBe("22012");
            expect((result as any).error?.code).toBe("22012");
            expect(settledBeforeRelease).toBe(false);
            expect(observations).toEqual([]);
            expect((await load(records[3].id as string)).data.balance).toBe(
              100,
            );
          } else {
            expect(result).not.toHaveProperty("error");
            expect(setupCompletions).toBe(2);
            expect(observations).toEqual(["committed"]);
            const balances = await Promise.all(
              records.map(
                async (record) =>
                  (
                    await load(record.id as string)
                  ).data.balance,
              ),
            );
            expect(balances).toEqual([90, 80, 70, 60]);
          }
        } finally {
          release.resolve();
          if (lock) {
            await lock.query("SELECT pg_advisory_unlock($1)", [key]);
            await lock.release();
          }
          await transactionOutcome;
        }
      },
      10000,
    );
  },
);
