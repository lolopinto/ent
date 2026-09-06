import DB, { Dialect } from "./db";
import { withTransaction, TransactionScope } from "./transaction";
import { getTransactionState } from "./transaction_context";
import {
  loadEnt,
  loadEntX,
  loadEntFromClause,
  loadEntXFromClause,
  loadEnts,
  loadEntsFromClause,
  loadCustomEnts,
  loadRows,
  loadEdges,
} from "./ent";
import { Deny, PrivacyPolicy } from "./base";
import { ObjectLoaderFactory } from "./loaders";
import { Eq } from "./clause";
import { AlwaysDenyPrivacyPolicy } from "./privacy";
import { WriteOperation } from "../action/action";
import { Transaction } from "../action/transaction";
import { EntChangeset } from "../action/orchestrator";
import {
  BooleanType,
  IntegerType,
  UUIDType,
  StringType,
  SQLStatementOperation,
} from "../schema";
import {
  setupPostgres,
  getSchemaTable,
  assoc_edge_config_table,
  assoc_edge_table,
} from "../testutils/db/temp_db";
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
class ScopedAudit extends BaseEnt {
  nodeType = "ScopedAudit";
}
const accountSchema = getBuilderSchemaFromFields(
  {
    balance: IntegerType(),
    admin: BooleanType(),
    ownerID: UUIDType({ nullable: true }),
  },
  ScopedAccount,
);
const auditSchema = getBuilderSchemaFromFields(
  { message: StringType() },
  ScopedAudit,
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
function barrier(n: number) {
  const gate = deferred();
  return async () => {
    if (--n === 0) gate.resolve();
    await gate.promise;
  };
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

describe("transaction-scoped actions (disposable Postgres database)", () => {
  setupPostgres(() => [
    getSchemaTable(accountSchema, Dialect.Postgres),
    getSchemaTable(auditSchema, Dialect.Postgres),
    assoc_edge_config_table(),
    assoc_edge_table("scoped_account_edges"),
  ]);
  beforeEach(() => context.cache.reset());

  const create = (balance = 100, admin = true) =>
    new SimpleAction(
      viewer,
      accountSchema,
      new Map<string, any>([
        ["balance", balance],
        ["admin", admin],
      ]),
      WriteOperation.Insert,
      null,
    ).saveX();
  const edit = (ent: ScopedAccount, balance: number) =>
    new GuardedEdit(
      viewer,
      accountSchema,
      new Map<string, any>([["balance", balance]]),
      WriteOperation.Edit,
      ent,
    );
  const audits = () =>
    DB.getInstance().getPool().query("SELECT * FROM scoped_audits");

  const assemblyEntrypoints = [
    "save",
    "saveX",
    "builder.save",
    "builder.saveX",
    "Transaction.run",
    "changeset.executor",
  ] as const;
  const assembleCycle = async (
    parent: SimpleAction<ScopedAccount>,
    entry: (typeof assemblyEntrypoints)[number],
  ) => {
    parent.getTriggers = () => [
      {
        async changeset(builder) {
          const child = new SimpleAction(
            viewer,
            accountSchema,
            new Map<string, any>([
              ["balance", 20],
              ["admin", true],
            ]),
            WriteOperation.Insert,
            null,
          );
          // Parent needs the child's ID, while the conditional child depends
          // on the parent. Preparation succeeds; executor assembly finds the cycle.
          builder.updateInput({ ownerID: child.builder });
          return child.changesetWithOptions_BETA({
            conditionalBuilder: builder,
          });
        },
      },
    ];
    switch (entry) {
      case "save":
      case "saveX":
        return parent[entry]();
      case "builder.save":
        return parent.builder.save();
      case "builder.saveX":
        return parent.builder.saveX();
      case "Transaction.run":
        return new Transaction(viewer, [parent]).run();
      case "changeset.executor":
        return (await parent.changeset()).executor();
    }
  };

  test.each(assemblyEntrypoints)(
    "caught graph assembly failure from %s rolls back earlier writes and observers",
    async (entry) => {
      const owner = await create();
      const observe = jest.fn();
      let caught: unknown;
      const outcome = withTransaction(async () => {
        const first = edit(await load(owner.id as string), 75);
        first.getObservers = () => [{ observe }];
        await first.saveX();
        try {
          await assembleCycle(edit(await load(owner.id as string), 50), entry);
        } catch (error) {
          caught = error;
        }
      });
      await expect(outcome).rejects.toThrow("Cycle found");
      expect(caught).toEqual(new Error("Cycle found"));
      expect((await load(owner.id as string)).data.balance).toBe(100);
      expect(observe).not.toHaveBeenCalled();
    },
  );

  test.each(assemblyEntrypoints)(
    "unscoped graph assembly failure from %s still rejects before writes",
    async (entry) => {
      const owner = await create();
      const parent = new SimpleAction(
        viewer,
        accountSchema,
        new Map([["balance", 50]]),
        WriteOperation.Edit,
        owner,
      );
      const observe = jest.fn();
      parent.getObservers = () => [{ observe }];
      await expect(assembleCycle(parent, entry)).rejects.toThrow("Cycle found");
      expect((await load(owner.id as string)).data.balance).toBe(100);
      expect(observe).not.toHaveBeenCalled();
    },
  );

  const saveFailureStages = [
    "build sync",
    "build async",
    "executor factory",
    "execute sync",
    "execute async",
  ] as const;
  const failingSave = (
    action: SimpleAction<ScopedAccount>,
    stage: (typeof saveFailureStages)[number],
    failure: Error,
  ) => {
    const fail = (): never => {
      throw failure;
    };
    if (stage === "build sync") {
      action.builder.build = fail;
    } else if (stage === "build async") {
      action.builder.build = async () => fail();
    } else {
      const build = action.builder.build.bind(action.builder);
      action.builder.build = async () => {
        const changeset = await build();
        if (stage === "executor factory") {
          changeset.executor = fail;
        } else {
          const executor = changeset.executor();
          executor.execute =
            stage === "execute sync" ? fail : async () => fail();
        }
        return changeset;
      };
    }
  };

  describe.each(["save", "saveX"] as const)(
    "builder.%s failure boundary",
    (entry) => {
      test.each(saveFailureStages)(
        "caught or suppressed %s failure still aborts the scope with the original error",
        async (stage) => {
          const owner = await create();
          const failure = new Error(stage);
          const observe = jest.fn();
          await expect(
            withTransaction(async () => {
              const first = edit(await load(owner.id as string), 75);
              first.getObservers = () => [{ observe }];
              await first.saveX();
              const next = edit(await load(owner.id as string), 50);
              failingSave(next, stage, failure);
              await next.builder[entry]().catch(() => {});
            }),
          ).rejects.toBe(failure);
          expect((await load(owner.id as string)).data.balance).toBe(100);
          expect(observe).not.toHaveBeenCalled();
        },
      );

      test.each(saveFailureStages)(
        "unscoped %s failure retains existing rejection and suppression behavior",
        async (stage) => {
          const owner = await create();
          const failure = new Error(stage);
          const action = new SimpleAction(
            viewer,
            accountSchema,
            new Map([["balance", 50]]),
            WriteOperation.Edit,
            owner,
          );
          failingSave(action, stage, failure);
          const result = action.builder[entry]();
          if (
            entry === "save" &&
            (stage.startsWith("build") || stage === "execute sync")
          ) {
            await expect(result).resolves.toBeUndefined();
          } else {
            await expect(result).rejects.toBe(failure);
          }
          expect((await load(owner.id as string)).data.balance).toBe(100);
        },
      );
    },
  );

  test.each(["sync", "async"] as const)(
    "caught custom grouped preparation %s failure aborts earlier writes",
    async (timing) => {
      const owner = await create();
      const failure = new Error("custom changeset preparation");
      const observe = jest.fn();
      await expect(
        withTransaction(async () => {
          const first = edit(await load(owner.id as string), 75);
          first.getObservers = () => [{ observe }];
          await first.saveX();
          const next = edit(await load(owner.id as string), 50);
          const fail = (): never => {
            throw failure;
          };
          next.changeset = timing === "sync" ? fail : async () => fail();
          await new Transaction(viewer, [next]).run().catch(() => {});
        }),
      ).rejects.toBe(failure);
      expect((await load(owner.id as string)).data.balance).toBe(100);
      expect(observe).not.toHaveBeenCalled();
    },
  );

  test.each(["list", "complex", "Transaction.run"] as const)(
    "caught %s execution context failure aborts earlier writes",
    async (entry) => {
      const owner = await create();
      const failure = new Error("execution context unavailable");
      const observe = jest.fn();
      await expect(
        withTransaction(async () => {
          const first = edit(await load(owner.id as string), 75);
          first.getObservers = () => [{ observe }];
          await first.saveX();
          const executionViewer = new TestContext().getViewer();
          const next = new SimpleAction(
            executionViewer,
            accountSchema,
            new Map([["balance", 50]]),
            WriteOperation.Edit,
            await load(owner.id as string),
          );
          if (entry === "complex") {
            next.getTriggers = () => [
              {
                changeset: () =>
                  new SimpleAction(
                    viewer,
                    auditSchema,
                    new Map([["message", "pending audit"]]),
                    WriteOperation.Insert,
                    null,
                  ).changeset(),
              },
            ];
          }
          const changeset = await next.changeset();
          const executor = changeset.executor();
          next.changeset = async () => changeset;
          Object.defineProperty(executionViewer, "context", {
            get() {
              throw failure;
            },
          });
          const execution =
            entry === "Transaction.run"
              ? new Transaction(executionViewer, [next]).run()
              : executor.execute();
          await execution.catch(() => {});
        }),
      ).rejects.toBe(failure);
      expect((await load(owner.id as string)).data.balance).toBe(100);
      expect((await audits()).rowCount).toBe(0);
      expect(observe).not.toHaveBeenCalled();
    },
  );

  const privacyReadPaths = [
    "nullable",
    "strict",
    "nullable clause",
    "strict clause",
    "bulk ids",
    "bulk clause",
    "custom bulk",
  ] as const;
  const loadWithFieldPrivacy = async (
    path: (typeof privacyReadPaths)[number],
    id: string,
    policy: PrivacyPolicy = AlwaysDenyPrivacyPolicy,
  ) => {
    // Separate request caches keep a paused private read independent of the
    // unredacted reader used to advance the same transaction's generation.
    const privateViewer = new TestContext().getViewer();
    const privateOptions = {
      ...options,
      fieldPrivacy: new Map([["admin", policy]]),
    };
    switch (path) {
      case "nullable":
        return loadEnt(privateViewer, id, privateOptions);
      case "strict":
        return loadEntX(privateViewer, id, privateOptions);
      case "nullable clause":
        return loadEntFromClause(privateViewer, privateOptions, Eq("id", id));
      case "strict clause":
        return loadEntXFromClause(privateViewer, privateOptions, Eq("id", id));
      case "bulk ids":
        return (await loadEnts(privateViewer, privateOptions, id)).get(id)!;
      case "bulk clause":
        return (
          await loadEntsFromClause(privateViewer, Eq("id", id), privateOptions)
        ).get(id)!;
      case "custom bulk":
        return (
          await loadCustomEnts(privateViewer, privateOptions, Eq("id", id))
        )[0];
    }
  };

  test.each(privacyReadPaths)(
    "fresh field-redacted %s reads remain valid guarded action inputs",
    async (path) => {
      const owner = await create();
      await withTransaction(async () => {
        const redacted = await loadWithFieldPrivacy(path, owner.id as string);
        expect(redacted!.data.admin).toBeNull();
        await edit(redacted!, 75).saveX();
      });
      const current = await load(owner.id as string);
      expect(current.data.balance).toBe(75);
      expect(current.data.admin).toBe(true);
    },
  );

  test.each(["nullable", "strict clause", "custom bulk"] as const)(
    "paused field privacy cannot freshen stale %s reads",
    async (path) => {
      const owner = await create();
      const expectedError =
        path === "strict clause"
          ? "reload existingEnt"
          : "cannot cross transaction generations";
      const started = deferred();
      const finish = deferred();
      const policy: PrivacyPolicy = {
        rules: [
          {
            async apply() {
              started.resolve();
              await finish.promise;
              return Deny();
            },
          },
        ],
      };
      await expect(
        withTransaction(async () => {
          const pending = loadWithFieldPrivacy(
            path,
            owner.id as string,
            policy,
          );
          await started.promise;
          try {
            await edit(await load(owner.id as string), 75).saveX();
          } finally {
            finish.resolve();
          }
          if (path !== "strict clause") {
            // Cached readers now reject before returning or priming old Ents.
            await expect(pending).rejects.toThrow(expectedError);
            return;
          }
          const stale = await pending;
          expect(stale!.data.admin).toBeNull();
          expect(stale!.data.balance).toBe(100);
          await expect(edit(stale!, 90).saveX()).rejects.toThrow(
            "reload existingEnt",
          );
        }),
      ).rejects.toThrow(expectedError);
      expect((await load(owner.id as string)).data.balance).toBe(100);
    },
  );

  test("field privacy preserves absent provenance for an outside read awaited in a scope", async () => {
    const owner = await create();
    const started = deferred();
    const finish = deferred();
    const outside = loadWithFieldPrivacy("strict", owner.id as string, {
      rules: [
        {
          async apply() {
            started.resolve();
            await finish.promise;
            return Deny();
          },
        },
      ],
    });
    await started.promise;
    await expect(
      withTransaction(async () => {
        try {
          await edit(await load(owner.id as string), 75).saveX();
        } finally {
          finish.resolve();
        }
        const unowned = await outside;
        expect(unowned!.data.admin).toBeNull();
        await expect(edit(unowned!, 90).saveX()).rejects.toThrow(
          "reload existingEnt",
        );
      }),
    ).rejects.toThrow("reload existingEnt");
    expect((await load(owner.id as string)).data.balance).toBe(100);
  });

  test.each(["saveX", "editedEntX"] as const)(
    "caught %s result privacy denial rolls back earlier writes, audits and observers",
    async (method) => {
      const [earlier, target] = await Promise.all([create(), create()]);
      const observe = jest.fn();
      const original = ScopedAccount.prototype.getPrivacyPolicy;
      const privacy = jest
        .spyOn(ScopedAccount.prototype, "getPrivacyPolicy")
        .mockImplementation(function (this: ScopedAccount) {
          return this.data.balance === 12
            ? AlwaysDenyPrivacyPolicy
            : original.call(this);
        });
      let caught: unknown;
      try {
        const failure = await withTransaction(async () => {
          for (const [account, balance] of [
            [earlier, 75],
            [target, 12],
          ] as const) {
            const action = edit(await load(account.id as string), balance);
            action.getObservers = () => [{ observe }];
            action.getTriggers = () => [
              {
                changeset: () =>
                  new SimpleAction(
                    viewer,
                    auditSchema,
                    new Map([["message", `balance ${balance}`]]),
                    WriteOperation.Insert,
                    null,
                  ).changeset(),
              },
            ];
            if (account === earlier) {
              await action.saveX();
            } else {
              try {
                if (method === "editedEntX") {
                  await action.builder.saveX();
                  await action.editedEntX();
                } else {
                  await action.saveX();
                }
              } catch (error) {
                caught = error;
              }
            }
          }
        }).then(
          () => undefined,
          (error) => error,
        );
        expect(caught).toEqual(
          new Error("was able to edit ent but not load it"),
        );
        expect(failure).toBe(caught);
        const rows = await DB.getInstance()
          .getPool()
          .query("SELECT balance FROM scoped_accounts");
        expect(rows.rows.map((row) => row.balance)).toEqual([100, 100]);
        expect((await audits()).rowCount).toBe(0);
        expect(observe).not.toHaveBeenCalled();
      } finally {
        privacy.mockRestore();
      }
    },
  );

  test.each(["save", "saveX"] as const)(
    "caught unexpected result failures from %s poison the owner",
    async (method) => {
      for (const source of [
        "viewer throw",
        "viewer reject",
        "privacy throw",
        "privacy reject",
      ] as const) {
        const owner = await create();
        const error = new Error(source);
        const original = ScopedAccount.prototype.getPrivacyPolicy;
        const privacy = jest
          .spyOn(ScopedAccount.prototype, "getPrivacyPolicy")
          .mockImplementation(function (this: ScopedAccount) {
            if (this.data.balance !== 12) return original.call(this);
            if (source === "privacy throw") throw error;
            if (source === "privacy reject") {
              return {
                rules: [
                  {
                    async apply() {
                      throw error;
                    },
                  },
                ],
              };
            }
            return original.call(this);
          });
        try {
          await expect(
            withTransaction(async () => {
              const action = edit(await load(owner.id as string), 12);
              if (source === "viewer throw") {
                action.viewerForEntLoad = () => {
                  throw error;
                };
              } else if (source === "viewer reject") {
                action.viewerForEntLoad = async () => {
                  throw error;
                };
              }
              await expect(action[method]()).rejects.toBe(error);
            }),
          ).rejects.toBe(error);
          expect((await load(owner.id as string)).data.balance).toBe(100);
        } finally {
          privacy.mockRestore();
        }
      }
    },
  );

  test("normal nullable result privacy denial still permits commit", async () => {
    const owner = await create();
    const observe = jest.fn();
    const original = ScopedAccount.prototype.getPrivacyPolicy;
    const privacy = jest
      .spyOn(ScopedAccount.prototype, "getPrivacyPolicy")
      .mockImplementation(function (this: ScopedAccount) {
        return this.data.balance === 12
          ? AlwaysDenyPrivacyPolicy
          : original.call(this);
      });
    try {
      await withTransaction(async () => {
        const action = edit(await load(owner.id as string), 12);
        action.getObservers = () => [{ observe }];
        action.getTriggers = () => [
          {
            changeset: () =>
              new SimpleAction(
                viewer,
                auditSchema,
                new Map([["message", "nullable result"]]),
                WriteOperation.Insert,
                null,
              ).changeset(),
          },
        ];
        await expect(action.save()).resolves.toBeNull();
        await expect(action.editedEnt()).resolves.toBeNull();
      });
      const rows = await DB.getInstance()
        .getPool()
        .query("SELECT balance FROM scoped_accounts WHERE id = $1", [owner.id]);
      expect(rows.rows[0].balance).toBe(12);
      expect((await audits()).rowCount).toBe(1);
      expect(observe).toHaveBeenCalledTimes(1);
    } finally {
      privacy.mockRestore();
    }
  });

  test.each(["editedEnt", "editedEntX"] as const)(
    "%s before writing preserves its nullable or throwing result contract",
    async (method) => {
      const owner = await create();
      let caught: unknown;
      const failure = await withTransaction(async () => {
        await edit(await load(owner.id as string), 75).saveX();
        const candidate = edit(await load(owner.id as string), 12);
        try {
          expect(await candidate[method]()).toBeNull();
        } catch (error) {
          caught = error;
        }
      }).then(
        () => undefined,
        (error) => error,
      );
      if (method === "editedEntX") {
        expect(caught).toEqual(new Error("ent was not created"));
        expect(failure).toBe(caught);
      } else {
        expect(caught).toBeUndefined();
        expect(failure).toBeUndefined();
      }
      expect((await load(owner.id as string)).data.balance).toBe(
        method === "editedEntX" ? 100 : 75,
      );
    },
  );

  test.each(["save", "saveX"] as const)(
    "ordinary %s result privacy behavior remains after its write commit",
    async (method) => {
      const owner = await create();
      const action = new SimpleAction(
        viewer,
        accountSchema,
        new Map([["balance", 12]]),
        WriteOperation.Edit,
        owner,
      );
      const observe = jest.fn();
      action.getObservers = () => [{ observe }];
      const original = ScopedAccount.prototype.getPrivacyPolicy;
      const privacy = jest
        .spyOn(ScopedAccount.prototype, "getPrivacyPolicy")
        .mockImplementation(function (this: ScopedAccount) {
          return this.data.balance === 12
            ? AlwaysDenyPrivacyPolicy
            : original.call(this);
        });
      try {
        if (method === "saveX") {
          await expect(action.saveX()).rejects.toThrow(
            "was able to edit ent but not load it",
          );
        } else {
          await expect(action.save()).resolves.toBeNull();
        }
        const rows = await DB.getInstance()
          .getPool()
          .query("SELECT balance FROM scoped_accounts WHERE id = $1", [
            owner.id,
          ]);
        expect(rows.rows[0].balance).toBe(12);
        expect(observe).toHaveBeenCalledTimes(1);
      } finally {
        privacy.mockRestore();
      }
    },
  );

  test.each(["editedEnt", "editedEntX"] as const)(
    "%s failures from an already committed owner do not poison another scope",
    async (method) => {
      const owner = await create();
      let previous!: GuardedEdit;
      await withTransaction(async () => {
        previous = edit(await load(owner.id as string), 75);
        await previous.saveX();
      });
      const error = new Error("old result viewer failed");
      previous.viewerForEntLoad = async () => {
        throw error;
      };
      await expect(previous[method]()).rejects.toBe(error);
      await withTransaction(async () => {
        await edit(await load(owner.id as string), 50).saveX();
        await expect(previous[method]()).rejects.toBe(error);
      });
      expect((await load(owner.id as string)).data.balance).toBe(50);
    },
  );

  test.each([
    ["same scope", "editedEnt"],
    ["same scope", "editedEntX"],
    ["previous scope", "editedEnt"],
    ["previous scope", "editedEntX"],
    ["unscoped", "editedEnt"],
    ["unscoped", "editedEntX"],
  ] as const)(
    "%s %s snapshots cannot become fresh inputs to a guarded mutation",
    async (origin, method) => {
      const owner = await create();
      let previous!: SimpleAction<ScopedAccount>;
      const savePrevious = async () => {
        previous = edit(await load(owner.id as string), 90);
        await previous.saveX();
      };
      if (origin === "previous scope") {
        await withTransaction(savePrevious);
      } else if (origin === "unscoped") {
        previous = new SimpleAction(
          viewer,
          accountSchema,
          new Map([["balance", 90]]),
          WriteOperation.Edit,
          owner,
        );
        await previous.saveX();
      }
      await expect(
        withTransaction(async () => {
          if (origin === "same scope") await savePrevious();
          await edit(await load(owner.id as string), 80).saveX();
          const snapshot = await previous[method]();
          expect(snapshot!.data.balance).toBe(90);
          await expect(
            edit(snapshot!, snapshot!.data.balance - 1).saveX(),
          ).rejects.toThrow("reload existingEnt");
        }),
      ).rejects.toThrow("reload existingEnt");
      expect((await load(owner.id as string)).data.balance).toBe(
        origin === "same scope" ? 100 : 90,
      );
      // Reading a result snapshot remains allowed outside its owning scope.
      expect((await previous.editedEntX()).data.balance).toBe(90);
    },
  );

  test.each(["root", "child"] as const)(
    "fresh %s results retain the completed write's current provenance",
    async (source) => {
      const [owner, target] = await Promise.all([create(), create()]);
      await withTransaction(async () => {
        const parent = edit(await load(owner.id as string), 90);
        let child!: SimpleAction<ScopedAccount>;
        parent.getTriggers = () => [
          {
            async changeset() {
              child = new SimpleAction(
                viewer,
                accountSchema,
                new Map([["balance", 80]]),
                WriteOperation.Edit,
                await load(target.id as string),
              );
              return child.changeset();
            },
          },
        ];
        const parentResult = await parent.saveX();
        const result =
          source === "root" ? parentResult : await child.editedEntX();
        await edit(result, result.data.balance - 1).saveX();
      });
      expect((await load(owner.id as string)).data.balance).toBe(
        source === "root" ? 89 : 90,
      );
      expect((await load(target.id as string)).data.balance).toBe(
        source === "child" ? 79 : 80,
      );
    },
  );

  test("scope covers privacy, triggers, validators, action writes and audit changesets; observers follow outer commit", async () => {
    const account = await create();
    const observed: number[] = [];
    let scopedPid = 0;
    await withTransaction(async (tx) => {
      scopedPid = (await tx.query("SELECT pg_backend_pid() AS pid")).rows[0]
        .pid;
      const action = edit(await load(account.id as string), 75);
      action.getPrivacyPolicy = () => ({
        rules: [
          {
            async apply() {
              expect(getTransactionState()).toBeDefined();
              const { rows } = await DB.getInstance()
                .getPool()
                .query("SELECT pg_backend_pid() AS pid");
              expect(rows[0].pid).toBe(scopedPid);
              return (await import("./base")).Allow();
            },
          },
        ],
      });
      action.getTriggers = () => [
        {
          async changeset() {
            expect((await load(account.id as string)).data.balance).toBe(100);
            return new SimpleAction(
              viewer,
              auditSchema,
              new Map([["message", "sale"]]),
              WriteOperation.Insert,
              null,
            ).changeset();
          },
        },
      ];
      action.getValidators = () => [
        {
          async validate() {
            expect(getTransactionState()).toBeDefined();
            expect((await load(account.id as string)).data.balance).toBe(100);
          },
        },
      ];
      action.getObservers = () => [
        {
          async observe() {
            expect(getTransactionState()).toBeUndefined();
            observed.push((await load(account.id as string)).data.balance);
          },
        },
      ];
      expect((await action.saveX()).data.balance).toBe(75);
      expect((await load(account.id as string)).data.balance).toBe(75);
      expect((await audits()).rowCount).toBe(1);
      expect(observed).toEqual([]);
    });
    expect(observed).toEqual([75]);
    expect((await audits()).rowCount).toBe(1);
  });

  test("rollback discards action, trigger audit and observers, and never primes outside caches", async () => {
    const account = await create();
    const outside = await load(account.id as string);
    const observe = jest.fn();
    await expect(
      withTransaction(async () => {
        const action = edit(await load(account.id as string), 30);
        action.getTriggers = () => [
          {
            changeset: () =>
              new SimpleAction(
                viewer,
                auditSchema,
                new Map([["message", "rolled back"]]),
                WriteOperation.Insert,
                null,
              ).changeset(),
          },
        ];
        action.getObservers = () => [{ observe }];
        await action.saveX();
        throw new Error("abort");
      }),
    ).rejects.toThrow("abort");
    expect((await load(account.id as string)).data.balance).toBe(100);
    expect(outside.data.balance).toBe(100);
    expect((await audits()).rowCount).toBe(0);
    expect(observe).not.toHaveBeenCalled();
  });

  test("observers and callers can read committed builder IDs without rerunning preparation", async () => {
    const effects: string[] = [];
    let action!: SimpleAction<ScopedAccount>;
    const result = await withTransaction(async () => {
      action = new SimpleAction(
        viewer,
        accountSchema,
        new Map<string, any>([
          ["balance", 100],
          ["admin", true],
        ]),
        WriteOperation.Insert,
        null,
      );
      action.getObservers = () => [
        {
          async observe(builder) {
            // Generated builder.getEntID() calls this same public method.
            const edited = await builder.orchestrator.getEditedData();
            effects.push(edited.id);
          },
        },
      ];
      return action.saveX();
    });
    // Assertion outside observer is essential: observers swallow exceptions.
    expect(effects).toEqual([result.id]);
    expect((await action.builder.orchestrator.getEditedData()).id).toBe(
      result.id,
    );
    await expect(action.saveX()).rejects.toThrow("transaction scopes");
  });

  test("concurrent async flows sharing one viewer never join each other's transactions or caches", async () => {
    const account = await create();
    const written = deferred();
    const release = deferred();
    const worker = withTransaction(async () => {
      await edit(await load(account.id as string), 9).saveX();
      written.resolve();
      await release.promise;
      expect((await load(account.id as string)).data.balance).toBe(9);
    });
    await written.promise;
    try {
      expect((await load(account.id as string)).data.balance).toBe(100);
      await withTransaction(async () => {
        expect((await load(account.id as string)).data.balance).toBe(100);
      });
    } finally {
      release.resolve();
    }
    await worker;
    expect((await load(account.id as string)).data.balance).toBe(9);
  });

  test("serializable retries rebuild absolute balance updates and audit actions, preventing lost sales", async () => {
    const account = await create();
    const meet = barrier(2);
    const attempts: number[] = [];
    let observers = 0;
    const sell = (amount: number) =>
      withTransaction(
        async (tx) => {
          attempts.push(tx.attempt);
          const current = await load(account.id as string);
          if (tx.attempt === 0) await meet();
          const action = edit(current, current.data.balance - amount);
          action.getTriggers = () => [
            {
              changeset: () =>
                new SimpleAction(
                  viewer,
                  auditSchema,
                  new Map([["message", `sold ${amount}`]]),
                  WriteOperation.Insert,
                  null,
                ).changeset(),
            },
          ];
          action.getObservers = () => [
            {
              async observe() {
                observers++;
              },
            },
          ];
          await action.saveX();
        },
        { maxRetries: 3 },
      );
    await Promise.all([sell(20), sell(30)]);
    expect((await load(account.id as string)).data.balance).toBe(50);
    expect(attempts).toContain(1);
    expect((await audits()).rowCount).toBe(2);
    expect(observers).toBe(2);
  });

  test("serializable predicate conflict preserves the last admin and its audit history", async () => {
    const accounts = await Promise.all([create(), create()]);
    const meet = barrier(2);
    const removeAdmin = (account: ScopedAccount) =>
      withTransaction(
        async (tx) => {
          const current = await load(account.id as string);
          const action = new GuardedEdit(
            viewer,
            accountSchema,
            new Map([["admin", false]]),
            WriteOperation.Edit,
            current,
          );
          action.getValidators = () => [
            {
              async validate() {
                const rows = await loadRows({
                  ...options,
                  clause: Eq("admin", true),
                  context,
                });
                if (tx.attempt === 0) await meet();
                if (rows.length <= 1) throw new Error("last admin");
              },
            },
          ];
          action.getTriggers = () => [
            {
              changeset: () =>
                new SimpleAction(
                  viewer,
                  auditSchema,
                  new Map([["message", "removed admin"]]),
                  WriteOperation.Insert,
                  null,
                ).changeset(),
            },
          ];
          await action.saveX();
        },
        { maxRetries: 3 },
      );
    const results = await Promise.allSettled(accounts.map(removeAdmin));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      results.find((r): r is PromiseRejectedResult => r.status === "rejected")
        ?.reason.message,
    ).toBe("last admin");
    expect(
      (await loadRows({ ...options, clause: Eq("admin", true), context }))
        .length,
    ).toBe(1);
    expect((await audits()).rowCount).toBe(1);
  });

  test("read committed lock contract reloads after lock and serializes absolute updates", async () => {
    const account = await create();
    const locked = deferred();
    const release = deferred();
    const first = withTransaction(
      async (tx) => {
        await tx.query(
          "SELECT id FROM scoped_accounts WHERE id = $1 FOR UPDATE",
          [account.id],
        );
        locked.resolve();
        await release.promise;
        const current = await load(account.id as string);
        await edit(current, current.data.balance - 20).saveX();
      },
      { isolationLevel: "read committed" },
    );
    await locked.promise;
    const secondStarted = deferred();
    const second = withTransaction(
      async (tx) => {
        // This cached value must be invalidated by the explicit lock query.
        expect((await load(account.id as string)).data.balance).toBe(100);
        const wait = tx.query(
          "SELECT id FROM scoped_accounts WHERE id = $1 FOR UPDATE",
          [account.id],
        );
        secondStarted.resolve();
        await wait;
        const current = await load(account.id as string);
        expect(current.data.balance).toBe(80);
        await edit(current, current.data.balance - 30).saveX();
      },
      { isolationLevel: "read committed" },
    );
    await secondStarted.promise;
    release.resolve();
    await Promise.all([first, second]);
    expect((await load(account.id as string)).data.balance).toBe(50);
  });

  test("guarded direct saves/builders/changesets fail closed and stale Ents cannot cross scopes", async () => {
    const account = await create();
    await expect(edit(account, 1).saveX()).rejects.toThrow(
      "requires withTransaction",
    );
    await expect(edit(account, 1).builder.saveX()).rejects.toThrow(
      "requires withTransaction",
    );
    await expect(edit(account, 1).changeset()).rejects.toThrow(
      "requires withTransaction",
    );
    await expect(
      withTransaction(async () => edit(account, 1).saveX()),
    ).rejects.toThrow("reload existingEnt");
    const oldAction = edit(account, 1);
    await expect(
      withTransaction(async () => oldAction.saveX()),
    ).rejects.toThrow("cannot cross transaction scopes");
    let oldChangeset: Awaited<ReturnType<GuardedEdit["changeset"]>>;
    await withTransaction(async () => {
      oldChangeset = await edit(
        await load(account.id as string),
        1,
      ).changeset();
    });
    expect(() => oldChangeset!.executor()).toThrow("transaction");
    expect((await load(account.id as string)).data.balance).toBe(100);
  });

  test("privacy denial rolls back earlier actions; legacy action Transaction groups join outer scope", async () => {
    const account = await create();
    await expect(
      withTransaction(async () => {
        await new Transaction(viewer, [
          edit(await load(account.id as string), 50),
        ]).run();
        const deny = edit(await load(account.id as string), 1);
        deny.getPrivacyPolicy = () => AlwaysDenyPrivacyPolicy;
        await deny.saveX();
      }),
    ).rejects.toThrow("permission");
    expect((await load(account.id as string)).data.balance).toBe(100);
  });

  test("caught SQL errors still abort and borrowed clients/nested scopes are rejected", async () => {
    const account = await create();
    await expect(
      withTransaction(async (tx) => {
        await edit(await load(account.id as string), 1).saveX();
        await tx
          .query("SELECT no_such_column FROM scoped_accounts")
          .catch(() => {});
      }),
    ).rejects.toThrow("no_such_column");
    expect((await load(account.id as string)).data.balance).toBe(100);
    await withTransaction(async () => {
      await expect(withTransaction(async () => {})).rejects.toThrow("nested");
      await expect(DB.getInstance().getNewClient()).rejects.toThrow("escape");
      expect(() => DB.getInstance().getConnection()).toThrow("raw connections");
    });
  });

  test("serializable action requirement rejects weaker isolation before triggers", async () => {
    const account = await create();
    const trigger = jest.fn();
    await expect(
      withTransaction(
        async () => {
          const action = edit(await load(account.id as string), 0);
          Object.assign(action, { requiresTransaction: () => "serializable" });
          action.getTriggers = () => [{ changeset: trigger }];
          await action.saveX();
        },
        { isolationLevel: "read committed" },
      ),
    ).rejects.toThrow("serializable");
    expect(trigger).not.toHaveBeenCalled();
  });

  test("a swallowed non-X validation failure still rolls back earlier writes", async () => {
    const account = await create();
    await expect(
      withTransaction(async () => {
        await edit(await load(account.id as string), 50).saveX();
        const invalid = edit(await load(account.id as string), 0);
        invalid.getValidators = () => [
          {
            async validate() {
              throw new Error("invalid balance");
            },
          },
        ];
        await invalid.builder.save();
      }),
    ).rejects.toThrow("invalid balance");
    expect((await load(account.id as string)).data.balance).toBe(100);
  });

  test("caught changeset preparation failure still aborts the owning scope", async () => {
    const account = await create();
    await expect(
      withTransaction(async () => {
        await edit(await load(account.id as string), 50).saveX();
        const invalid = edit(await load(account.id as string), 0);
        invalid.getValidators = () => [
          {
            async validate() {
              throw new Error("invalid changeset");
            },
          },
        ];
        await invalid.changeset().catch(() => {});
      }),
    ).rejects.toThrow("invalid changeset");
    expect((await load(account.id as string)).data.balance).toBe(100);
  });

  test("retained loaders and queryers reject scope leaks, including detached async work", async () => {
    const account = await create();
    const outsideLoader = loaderFactory.createLoader(context);
    await outsideLoader.load(account.id);
    let scope!: TransactionScope;
    let closedQuery!: () => Promise<unknown>;
    const gate = deferred();
    let detached!: Promise<unknown>;
    await withTransaction(async (tx) => {
      scope = tx;
      await expect(outsideLoader.load(account.id)).rejects.toThrow(
        "cannot cross transaction scopes",
      );
      const inside = loaderFactory.createLoader(context);
      await inside.load(account.id);
      closedQuery = () => inside.load(account.id);
      detached = gate.promise.then(() => load(account.id as string));
    });
    expect(() => scope.query("SELECT 1")).toThrow("outside its callback");
    await expect(closedQuery()).rejects.toThrow(
      "cannot cross transaction scopes",
    );
    gate.resolve();
    await expect(detached).rejects.toThrow("scope is closed");
  });

  test("raw writes invalidate all transaction viewers' caches", async () => {
    const account = await create();
    const other = new TestContext();
    await withTransaction(async (tx) => {
      expect((await load(account.id as string)).data.balance).toBe(100);
      expect(
        (await loadEntX(other.getViewer(), account.id, options)).data.balance,
      ).toBe(100);
      await tx.query("UPDATE scoped_accounts SET balance = 12 WHERE id = $1", [
        account.id,
      ]);
      expect((await load(account.id as string)).data.balance).toBe(12);
      expect(
        (await loadEntX(other.getViewer(), account.id, options)).data.balance,
      ).toBe(12);
    });
  });

  test("edge deletion invalidates scoped edge reads and committed request reads", async () => {
    const edgeType = "9ef2a851-15a8-446d-8428-b5f11e641fec";
    await DB.getInstance()
      .getPool()
      .query(
        "INSERT INTO assoc_edge_config (edge_type, edge_name, edge_table, symmetric_edge, inverse_edge_type, created_at, updated_at) VALUES ($1, 'scoped admin', 'scoped_account_edges', false, NULL, now(), now())",
        [edgeType],
      );
    const [owner, target] = await Promise.all([create(), create()]);
    const readEdges = () => loadEdges({ id1: owner.id, edgeType, context });
    await withTransaction(async () => {
      const action = edit(await load(owner.id as string), 100);
      action.builder.orchestrator.addOutboundEdge(
        target.id,
        edgeType,
        target.nodeType,
      );
      await action.saveX();
    });
    expect((await readEdges()).length).toBe(1);
    await withTransaction(async () => {
      expect((await readEdges()).length).toBe(1);
      const action = edit(await load(owner.id as string), 100);
      action.builder.orchestrator.removeOutboundEdge(target.id, edgeType);
      await action.saveX();
      expect(await readEdges()).toEqual([]);
    });
    expect(await readEdges()).toEqual([]);
  });

  test("prebuilt guarded sale roots in one Transaction fail before losing an absolute balance update", async () => {
    const account = await create();
    await expect(
      withTransaction(async () => {
        const current = await load(account.id as string);
        await new Transaction(viewer, [
          edit(current, 80),
          edit(current, 70),
        ]).run();
      }),
    ).rejects.toThrow("guarded root actions");
    expect((await load(account.id as string)).data.balance).toBe(100);
  });

  test("prebuilt guarded admin roots cannot both validate against the old count", async () => {
    const accounts = await Promise.all([create(), create()]);
    await expect(
      withTransaction(async () => {
        const actions = await Promise.all(
          accounts.map(async (account) => {
            const action = new GuardedEdit(
              viewer,
              accountSchema,
              new Map([["admin", false]]),
              WriteOperation.Edit,
              await load(account.id as string),
            );
            action.getValidators = () => [
              {
                async validate() {
                  const rows = await loadRows({
                    ...options,
                    clause: Eq("admin", true),
                    context,
                  });
                  if (rows.length <= 1) throw new Error("last admin");
                },
              },
            ];
            return action;
          }),
        );
        await new Transaction(viewer, actions).run();
      }),
    ).rejects.toThrow("guarded root actions");
    expect(
      (await loadRows({ ...options, clause: Eq("admin", true), context }))
        .length,
    ).toBe(2);
  });

  test("parallel guarded root saves roll back, while sequential saves reload fresh state", async () => {
    const account = await create();
    await expect(
      withTransaction(async () => {
        const current = await load(account.id as string);
        await Promise.all([
          edit(current, 80).saveX(),
          edit(current, 70).saveX(),
        ]);
      }),
    ).rejects.toThrow("guarded root actions");
    expect((await load(account.id as string)).data.balance).toBe(100);
    await withTransaction(async () => {
      await edit(await load(account.id as string), 80).saveX();
      const fresh = await load(account.id as string);
      await edit(fresh, fresh.data.balance - 30).saveX();
    });
    expect((await load(account.id as string)).data.balance).toBe(50);
  });

  test("an Ent loaded before a previous guarded save cannot feed the next root", async () => {
    const account = await create();
    await expect(
      withTransaction(async () => {
        const old = await load(account.id as string);
        await edit(old, 80).saveX();
        await edit(old, 70).saveX();
      }),
    ).rejects.toThrow("reload existingEnt");
    expect((await load(account.id as string)).data.balance).toBe(100);
  });

  test("guarded root permits distinct trigger child changesets and releases the complete tree", async () => {
    const accounts = await Promise.all([create(), create(), create()]);
    await withTransaction(async () => {
      const current = await Promise.all(
        accounts.map((account) => load(account.id as string)),
      );
      const parent = independent(
        edit(current[0], 90),
        `account:${current[0].id}`,
      );
      parent.getTriggers = () => [
        {
          changeset: async () => [
            await independent(
              edit(current[1], 80),
              `account:${current[1].id}`,
            ).changeset(),
            await independent(
              edit(current[2], 70),
              `account:${current[2].id}`,
            ).changeset(),
          ],
        },
      ];
      await parent.saveX();
      await edit(await load(accounts[0].id as string), 60).saveX();
    });
    expect(
      (
        await Promise.all(accounts.map((account) => load(account.id as string)))
      ).map((account) => account.data.balance),
    ).toEqual([60, 80, 70]);
  });

  test("nested trigger saves and sibling child writes to one Ent fail closed", async () => {
    const [owner, target] = await Promise.all([create(), create()]);
    await expect(
      withTransaction(async () => {
        const parent = edit(await load(owner.id as string), 90);
        parent.getTriggers = () => [
          {
            async changeset() {
              const current = await load(target.id as string);
              await Promise.all([
                edit(current, 80).saveX(),
                edit(current, 70).saveX(),
              ]);
            },
          },
        ];
        await parent.saveX();
      }),
    ).rejects.toThrow("nested action saves");
    await expect(
      withTransaction(async () => {
        // An unguarded wrapper must not let guarded sibling children bypass checks.
        const parent = new SimpleAction(
          viewer,
          accountSchema,
          new Map([["balance", 90]]),
          WriteOperation.Edit,
          await load(owner.id as string),
        );
        parent.getTriggers = () => [
          {
            async changeset() {
              const current = await load(target.id as string);
              return [
                // Even mistaken disjoint declarations cannot hide known duplicate row writes.
                await independent(edit(current, 80), "first").changeset(),
                await independent(edit(current, 70), "second").changeset(),
              ];
            },
          },
        ];
        await parent.saveX();
      }),
    ).rejects.toThrow("same Ent through multiple builders");
    expect((await load(owner.id as string)).data.balance).toBe(100);
    expect((await load(target.id as string)).data.balance).toBe(100);
  });

  test("distinct nested edge writes on the same Ent do not count as duplicate row mutations", async () => {
    const edgeType = "ed93ad2e-20ea-4ab4-b9a4-97051857589d";
    await DB.getInstance()
      .getPool()
      .query(
        "INSERT INTO assoc_edge_config (edge_type, edge_name, edge_table, symmetric_edge, inverse_edge_type, created_at, updated_at) VALUES ($1, 'scoped member', 'scoped_account_edges', false, NULL, now(), now())",
        [edgeType],
      );
    const [owner, first, second] = await Promise.all([
      create(),
      create(),
      create(),
    ]);
    await withTransaction(async () => {
      const current = await load(owner.id as string);
      const parent = independent(
        new GuardedEdit(
          viewer,
          accountSchema,
          new Map(),
          WriteOperation.Edit,
          current,
        ),
        `edge:${owner.id}:${first.id}`,
      );
      parent.builder.orchestrator.addOutboundEdge(
        first.id,
        edgeType,
        first.nodeType,
      );
      parent.getTriggers = () => [
        {
          async changeset() {
            const child = independent(
              new GuardedEdit(
                viewer,
                accountSchema,
                new Map(),
                WriteOperation.Edit,
                current,
              ),
              `edge:${owner.id}:${second.id}`,
            );
            child.builder.orchestrator.addOutboundEdge(
              second.id,
              edgeType,
              second.nodeType,
            );
            return child.changeset();
          },
        },
      ];
      await parent.saveX();
    });
    expect(
      (await loadEdges({ id1: owner.id, edgeType, context }))
        .map((edge) => edge.id2)
        .sort(),
    ).toEqual([first.id, second.id].sort());
  });

  test("skipped child writes do not conflict and distinct nested deletions remain supported", async () => {
    const accounts = await Promise.all([create(), create(), create()]);
    await withTransaction(async () => {
      const current = await load(accounts[0].id as string);
      const parent = edit(current, 80);
      parent.getTriggers = () => [
        {
          async changeset() {
            const child = new SimpleAction(
              viewer,
              accountSchema,
              new Map([["balance", 70]]),
              WriteOperation.Edit,
              current,
            );
            const changeset = await child.builder.orchestrator.build();
            changeset.operations[0].shortCircuit = () => true;
            return changeset;
          },
        },
      ];
      await parent.saveX();
    });
    expect((await load(accounts[0].id as string)).data.balance).toBe(80);
    await withTransaction(async () => {
      const current = await Promise.all(
        accounts.map((account) => load(account.id as string)),
      );
      const parent = independent(
        new GuardedEdit(
          viewer,
          accountSchema,
          new Map(),
          WriteOperation.Delete,
          current[0],
        ),
        `account:${current[0].id}`,
      );
      parent.getTriggers = () => [
        {
          changeset: () =>
            Promise.all(
              current
                .slice(1)
                .map((account) =>
                  independent(
                    new GuardedEdit(
                      viewer,
                      accountSchema,
                      new Map(),
                      WriteOperation.Delete,
                      account,
                    ),
                    `account:${account.id}`,
                  ).changeset(),
                ),
            ),
        },
      ];
      await parent.builder.saveX();
    });
    expect(
      (await DB.getInstance().getPool().query("SELECT * FROM scoped_accounts"))
        .rowCount,
    ).toBe(0);
  });

  test("unguarded wrapper cannot combine guarded last-admin removals of distinct rows", async () => {
    const accounts = await Promise.all([create(), create()]);
    await expect(
      withTransaction(async () => {
        const parent = new SimpleAction(
          viewer,
          auditSchema,
          new Map([["message", "remove admins"]]),
          WriteOperation.Insert,
          null,
        );
        parent.getTriggers = () => [
          {
            async changeset() {
              return Promise.all(
                accounts.map(async (account) => {
                  const child = new GuardedEdit(
                    viewer,
                    accountSchema,
                    new Map([["admin", false]]),
                    WriteOperation.Edit,
                    await load(account.id as string),
                  );
                  child.getValidators = () => [
                    {
                      async validate() {
                        const rows = await loadRows({
                          ...options,
                          clause: Eq("admin", true),
                          context,
                        });
                        if (rows.length <= 1) throw new Error("last admin");
                      },
                    },
                  ];
                  return child.changeset();
                }),
              );
            },
          },
        ];
        await parent.saveX();
      }),
    ).rejects.toThrow("overlapping guarded action preparation branches");
    expect(
      (await loadRows({ ...options, clause: Eq("admin", true), context }))
        .length,
    ).toBe(2);
    expect((await audits()).rowCount).toBe(0);
  });

  test.each([
    [undefined, undefined, false],
    ["admins", "admins", false],
    [undefined, "admins", false],
    ["admins", undefined, false],
    [undefined, undefined, true],
  ] as const)(
    "ancestor and descendant cannot independently decide the last-admin invariant (%s, %s, wrapper=%s)",
    async (parentKey, childKey, wrapper) => {
      const accounts = await Promise.all([create(), create()]);
      const remove = async (id: string, key: string | undefined) => {
        const action = new GuardedEdit(
          viewer,
          accountSchema,
          new Map([["admin", false]]),
          WriteOperation.Edit,
          await load(id),
        );
        if (key) independent(action, key);
        action.getValidators = () => [
          {
            async validate() {
              const rows = await loadRows({
                ...options,
                clause: Eq("admin", true),
                context,
              });
              if (rows.length <= 1) throw new Error("last admin");
            },
          },
        ];
        return action;
      };
      await expect(
        withTransaction(async () => {
          const parent = await remove(accounts[0].id as string, parentKey);
          const child = async () =>
            (await remove(accounts[1].id as string, childKey)).changeset();
          parent.getTriggers = () => [
            {
              async changeset() {
                if (!wrapper) return child();
                const intermediate = new SimpleAction(
                  viewer,
                  auditSchema,
                  new Map([["message", "remove admins"]]),
                  WriteOperation.Insert,
                  null,
                );
                intermediate.getTriggers = () => [{ changeset: child }];
                return intermediate.changeset();
              },
            },
          ];
          await parent.saveX();
        }),
      ).rejects.toThrow("overlapping guarded action preparation branches");
      expect(
        (await loadRows({ ...options, clause: Eq("admin", true), context }))
          .length,
      ).toBe(2);
      expect((await audits()).rowCount).toBe(0);
    },
  );

  test.each(["valid", "validX", "validWithErrors"] as const)(
    "%s then save rebuilds independent child changesets and writes each once",
    async (method) => {
      const [owner, target] = await Promise.all([create(), create()]);
      const observe = jest.fn();
      let retained!: Awaited<ReturnType<GuardedEdit["changeset"]>>;
      await withTransaction(async () => {
        const parent = independent(
          edit(await load(owner.id as string), 90),
          `account:${owner.id}`,
        );
        parent.getTriggers = () => [
          {
            async changeset() {
              const child = independent(
                edit(await load(target.id as string), 80),
                `account:${target.id}`,
              );
              child.getObservers = () => [{ observe }];
              child.getTriggers = () => [
                {
                  changeset: () =>
                    new SimpleAction(
                      viewer,
                      auditSchema,
                      new Map([["message", "child write"]]),
                      WriteOperation.Insert,
                      null,
                    ).changeset(),
                },
              ];
              retained = await child.changeset();
              return retained;
            },
          },
        ];
        const result = await parent[method]();
        expect(result).toEqual(
          method === "valid" ? true : method === "validX" ? undefined : [],
        );
        expect((await load(target.id as string)).data.balance).toBe(100);
        expect((await audits()).rowCount).toBe(0);
        expect(() => retained.executor()).toThrow(
          "prepared by public validation",
        );
        await parent.saveX();
        expect((await audits()).rowCount).toBe(1);
        expect(observe).not.toHaveBeenCalled();
      });
      expect((await load(owner.id as string)).data.balance).toBe(90);
      expect((await load(target.id as string)).data.balance).toBe(80);
      expect(observe).toHaveBeenCalledTimes(1);
    },
  );

  test.each(["valid", "validX", "validWithErrors"] as const)(
    "failed %s discards its child graph before a corrected save",
    async (method) => {
      const [owner, oldTarget, newTarget] = await Promise.all([
        create(),
        create(),
        create(),
      ]);
      await withTransaction(async () => {
        const parent = independent(
          edit(await load(owner.id as string), 90),
          `account:${owner.id}`,
        );
        let target = oldTarget;
        let invalid = true;
        const error = new Error("invalid candidate");
        parent.getValidators = () => [
          { validate: async () => (invalid ? error : undefined) },
        ];
        parent.getTriggers = () => [
          {
            changeset: async () =>
              independent(
                edit(await load(target.id as string), 80),
                `account:${target.id}`,
              ).changeset(),
          },
        ];
        if (method === "validX") {
          await expect(parent.validX()).rejects.toBe(error);
        } else {
          expect(await parent[method]()).toEqual(
            method === "valid" ? false : [error],
          );
        }
        target = newTarget;
        invalid = false;
        await parent.saveX();
      });
      expect((await load(owner.id as string)).data.balance).toBe(90);
      expect((await load(oldTarget.id as string)).data.balance).toBe(100);
      expect((await load(newTarget.id as string)).data.balance).toBe(80);
    },
  );

  describe.each([
    "siblings",
    "trigger group",
    "child array",
    "user Promise.all",
  ] as const)("parallel validation with %s", (shape) => {
    describe.each([false, true])("nested grandchildren %s", (nested) => {
      test.each(["valid", "validX", "validWithErrors"] as const)(
        "%s drains children before reporting a recoverable error and supports a corrected save",
        async (method) => {
          const accounts = await Promise.all(
            Array.from({ length: 5 }, () => create()),
          );
          const observe = jest.fn();
          await withTransaction(async () => {
            const actions = await Promise.all(
              accounts.map(async (account, index) =>
                independent(
                  edit(await load(account.id as string), 90 - index * 10),
                  `account:${account.id}`,
                ),
              ),
            );
            const [parent, invalidChild, slowChild, fastBranch, slowBranch] =
              actions;
            let invalid = true;
            const error = new Error("first invalid child");
            invalidChild.getValidators = () => [
              { validate: async () => (invalid ? error : undefined) },
            ];
            const started = deferred();
            const finish = deferred();
            slowChild.getObservers = () => [{ observe }];
            slowChild.getTriggers = () => [
              {
                changeset: async () => {
                  started.resolve();
                  await finish.promise;
                  return new SimpleAction(
                    viewer,
                    auditSchema,
                    new Map([["message", "drained child"]]),
                    WriteOperation.Insert,
                    null,
                  ).changeset();
                },
              },
            ];
            fastBranch.getTriggers = () => [
              { changeset: () => invalidChild.changeset() },
            ];
            slowBranch.getTriggers = () => [
              { changeset: () => slowChild.changeset() },
            ];
            const fast = nested ? fastBranch : invalidChild;
            const slow = nested ? slowBranch : slowChild;
            let pendingSlow!: Promise<unknown>;
            const prepareSlow = () => {
              const pending = slow.changeset();
              pendingSlow = pending;
              return pending;
            };
            if (shape === "siblings") {
              parent.getTriggers = () => [
                { changeset: () => fast.changeset() },
                { changeset: prepareSlow },
              ];
            } else if (shape === "trigger group") {
              parent.getTriggers = () => [
                [
                  { changeset: () => fast.changeset() },
                  { changeset: prepareSlow },
                ],
              ];
            } else if (shape === "child array") {
              parent.getTriggers = () => [
                { changeset: () => [fast.changeset(), prepareSlow()] },
              ];
            } else {
              parent.getTriggers = () => [
                {
                  changeset: () =>
                    Promise.all([fast.changeset(), prepareSlow()]),
                },
              ];
            }
            let settled = false;
            const validation = parent[method]().then(
              (value) => {
                settled = true;
                return { value };
              },
              (error) => {
                settled = true;
                return { error };
              },
            );
            await started.promise;
            // Release independently of validation completion so both the old
            // fail-fast behavior and the repaired drain remain deterministic.
            await new Promise((resolve) => setImmediate(resolve));
            const settledBeforeRelease = settled;
            finish.resolve();
            expect(await validation).toEqual({ error });
            await expect(pendingSlow).resolves.toBeDefined();
            expect(settledBeforeRelease).toBe(false);
            expect(getTransactionState()!.failed).toBe(false);
            expect((await audits()).rowCount).toBe(0);
            invalid = false;
            await parent.saveX();
            expect((await audits()).rowCount).toBe(1);
            expect(observe).not.toHaveBeenCalled();
          });
          expect((await load(accounts[0].id as string)).data.balance).toBe(90);
          expect((await load(accounts[1].id as string)).data.balance).toBe(80);
          expect((await load(accounts[2].id as string)).data.balance).toBe(70);
          expect((await audits()).rowCount).toBe(1);
          expect(observe).toHaveBeenCalledTimes(1);
        },
      );
    });
  });

  test.each(["sql", "composition"] as const)(
    "late %s failures remain fatal while parallel validation preserves its first normal error",
    async (failure) => {
      const [owner, one, two] = await Promise.all([
        create(),
        create(),
        create(),
      ]);
      const firstError = new Error("first ordinary validation error");
      const started = deferred();
      const finish = deferred();
      await expect(
        withTransaction(async () => {
          await edit(await load(owner.id as string), 75).saveX();
          const parent = independent(
            edit(await load(owner.id as string), 90),
            `account:${owner.id}`,
          );
          const invalid = independent(
            edit(await load(one.id as string), 80),
            `account:${one.id}`,
          );
          invalid.getValidators = () => [{ validate: async () => firstError }];
          const slow = independent(
            edit(await load(two.id as string), 70),
            `account:${two.id}`,
          );
          slow.getTriggers = () => [
            {
              changeset: async () => {
                started.resolve();
                await finish.promise;
                if (failure === "sql") {
                  await DB.getInstance()
                    .getPool()
                    .query("SELECT * FROM missing_parallel_validation_table");
                } else {
                  return independent(
                    edit(await load(owner.id as string), 60),
                    `account:${owner.id}`,
                  ).changeset();
                }
              },
            },
          ];
          parent.getTriggers = () => [
            { changeset: () => invalid.changeset() },
            { changeset: () => slow.changeset() },
          ];
          const validation = expect(parent.validX()).rejects.toBe(firstError);
          await started.promise;
          await new Promise((resolve) => setImmediate(resolve));
          finish.resolve();
          await validation;
        }),
      ).rejects.toThrow(
        failure === "sql"
          ? "missing_parallel_validation_table"
          : "overlapping guarded action preparation branches",
      );
      expect((await load(owner.id as string)).data.balance).toBe(100);
    },
  );

  test("outside a transaction parallel child validation retains fail-fast behavior", async () => {
    const [owner, one, two] = await Promise.all([create(), create(), create()]);
    const action = (ent: ScopedAccount) =>
      new SimpleAction(
        viewer,
        accountSchema,
        new Map([["balance", 80]]),
        WriteOperation.Edit,
        ent,
      );
    const parent = action(owner);
    const invalid = action(one);
    const slow = action(two);
    const error = new Error("unscoped validation error");
    invalid.getValidators = () => [{ validate: async () => error }];
    const started = deferred();
    const finish = deferred();
    slow.getTriggers = () => [
      {
        changeset: async () => {
          started.resolve();
          await finish.promise;
        },
      },
    ];
    let pendingSlow!: Promise<unknown>;
    parent.getTriggers = () => [
      { changeset: () => invalid.changeset() },
      {
        changeset: () => {
          const pending = slow.changeset();
          pendingSlow = pending;
          return pending;
        },
      },
    ];
    let settled = false;
    const validation = parent.validX().catch((e) => {
      settled = true;
      return e;
    });
    await started.promise;
    await new Promise((resolve) => setImmediate(resolve));
    const settledBeforeRelease = settled;
    finish.resolve();
    expect(await validation).toBe(error);
    await pendingSlow;
    expect(settledBeforeRelease).toBe(true);
  });

  test.each(["valid", "validX", "validWithErrors"] as const)(
    "%s releases successful and failed validation reservations for another root",
    async (method) => {
      const [owner, target] = await Promise.all([create(), create()]);
      await withTransaction(async () => {
        const parent = independent(
          edit(await load(owner.id as string), 90),
          `account:${owner.id}`,
        );
        parent.getTriggers = () => [
          {
            changeset: async () =>
              independent(
                edit(await load(target.id as string), 80),
                `account:${target.id}`,
              ).changeset(),
          },
        ];
        await parent[method]();
        const candidate = edit(await load(owner.id as string), 50);
        const error = new Error("invalid candidate");
        candidate.getValidators = () => [{ validate: async () => error }];
        if (method === "validX")
          await expect(candidate.validX()).rejects.toBe(error);
        else await candidate[method]();
        await edit(await load(target.id as string), 60).saveX();
      });
      expect((await load(owner.id as string)).data.balance).toBe(100);
      expect((await load(target.id as string)).data.balance).toBe(60);
    },
  );

  test.each(["valid", "validX", "validWithErrors"] as const)(
    "%s discards probe graphs from retained children and their grandchildren",
    async (method) => {
      const [owner, childTarget, grandchildTarget] = await Promise.all([
        create(),
        create(),
        create(),
      ]);
      const observe = jest.fn();
      await withTransaction(async () => {
        const parent = independent(
          edit(await load(owner.id as string), 90),
          `account:${owner.id}`,
        );
        const child = independent(
          edit(await load(childTarget.id as string), 80),
          `account:${childTarget.id}`,
        );
        child.getTriggers = () => [
          {
            async changeset() {
              const grandchild = independent(
                edit(await load(grandchildTarget.id as string), 70),
                `account:${grandchildTarget.id}`,
              );
              grandchild.getObservers = () => [{ observe }];
              grandchild.getTriggers = () => [
                {
                  changeset: () =>
                    new SimpleAction(
                      viewer,
                      auditSchema,
                      new Map([["message", "grandchild write"]]),
                      WriteOperation.Insert,
                      null,
                    ).changeset(),
                },
              ];
              return grandchild.changeset();
            },
          },
        ];
        parent.getTriggers = () => [{ changeset: () => child.changeset() }];
        let invalid = true;
        const error = new Error("invalid parent");
        parent.getValidators = () => [
          { validate: async () => (invalid ? error : undefined) },
        ];
        if (method === "validX")
          await expect(parent.validX()).rejects.toBe(error);
        else
          expect(await parent[method]()).toEqual(
            method === "valid" ? false : [error],
          );
        invalid = false;
        await parent[method]();
        await parent.saveX();
      });
      expect((await load(owner.id as string)).data.balance).toBe(90);
      expect((await load(childTarget.id as string)).data.balance).toBe(80);
      expect((await load(grandchildTarget.id as string)).data.balance).toBe(70);
      expect((await audits()).rowCount).toBe(1);
      expect(observe).toHaveBeenCalledTimes(1);
    },
  );

  test.each(["valid", "validX", "validWithErrors"] as const)(
    "%s permits correcting an invalid retained child before saving",
    async (method) => {
      const [owner, target] = await Promise.all([create(), create()]);
      await withTransaction(async () => {
        const parent = independent(
          edit(await load(owner.id as string), 90),
          `account:${owner.id}`,
        );
        const child = independent(
          edit(await load(target.id as string), 80),
          `account:${target.id}`,
        );
        let invalid = true;
        const error = new Error("invalid child");
        child.getValidators = () => [
          { validate: async () => (invalid ? error : undefined) },
        ];
        parent.getTriggers = () => [{ changeset: () => child.changeset() }];
        // Trigger changeset failures propagate even from valid/validWithErrors.
        await expect(parent[method]()).rejects.toBe(error);
        invalid = false;
        await parent.saveX();
      });
      expect((await load(owner.id as string)).data.balance).toBe(90);
      expect((await load(target.id as string)).data.balance).toBe(80);
    },
  );

  test.each([
    ["action", "valid"],
    ["action", "validX"],
    ["action", "validWithErrors"],
    ["schema", "valid"],
    ["schema", "validX"],
    ["schema", "validWithErrors"],
  ] as const)(
    "%s transform children survive failed and repeated %s probes",
    async (source, method) => {
      const owner = await create();
      await withTransaction(async () => {
        let message = "probe";
        const transform = ({ op }: { op: SQLStatementOperation }) => {
          if (op !== SQLStatementOperation.Delete) return null;
          return {
            op: SQLStatementOperation.Update,
            data: { admin: false },
            changeset: () =>
              new SimpleAction(
                viewer,
                auditSchema,
                new Map([["message", message]]),
                WriteOperation.Insert,
                null,
              ).changeset(),
          };
        };
        const schema =
          source === "schema"
            ? getBuilderSchemaFromFields(
                { balance: IntegerType(), admin: BooleanType() },
                ScopedAccount,
                {
                  patterns: [
                    {
                      name: "soft_delete",
                      fields: {},
                      transformWrite: transform,
                    },
                  ],
                },
              )
            : accountSchema;
        const parent = new GuardedEdit(
          viewer,
          schema,
          new Map([["balance", 90]]),
          WriteOperation.Delete,
          await load(owner.id as string),
        );
        if (source === "action")
          Object.assign(parent, { transformWrite: transform });
        let invalid = true;
        const error = new Error("invalid transformed action");
        parent.getValidators = () => [
          { validate: async () => (invalid ? error : undefined) },
        ];
        if (method === "validX")
          await expect(parent.validX()).rejects.toBe(error);
        else
          expect(await parent[method]()).toEqual(
            method === "valid" ? false : [error],
          );
        invalid = false;
        await parent[method]();
        await parent[method]();
        expect((await audits()).rowCount).toBe(0);
        message = "saved transform";
        await parent.saveX();
      });
      const current = await load(owner.id as string);
      expect(current.data.balance).toBe(90);
      expect(current.data.admin).toBe(false);
      expect((await audits()).rows.map((row) => row.message)).toEqual([
        "saved transform",
      ]);
    },
  );

  test("public validation restores an insert transformed into an existing target update", async () => {
    const owner = await create();
    await withTransaction(async () => {
      const parent = new GuardedEdit(
        viewer,
        accountSchema,
        new Map<string, any>([
          ["balance", 90],
          ["admin", false],
        ]),
        WriteOperation.Insert,
        null,
      );
      Object.assign(parent, {
        transformWrite: async ({ op }: { op: SQLStatementOperation }) => {
          if (op !== SQLStatementOperation.Insert) return null;
          return {
            op: SQLStatementOperation.Update,
            existingEnt: await load(owner.id as string),
            changeset: () =>
              new SimpleAction(
                viewer,
                auditSchema,
                new Map([["message", "transformed insert"]]),
                WriteOperation.Insert,
                null,
              ).changeset(),
          };
        },
      });
      await parent.validX();
      await parent.validX();
      expect((await parent.saveX()).id).toBe(owner.id);
    });
    expect((await load(owner.id as string)).data.balance).toBe(90);
    expect(
      (await DB.getInstance().getPool().query("SELECT * FROM scoped_accounts"))
        .rowCount,
    ).toBe(1);
    expect((await audits()).rowCount).toBe(1);
  });

  test("validation discards edges referencing probe-created child builders", async () => {
    const owner = await create();
    const edgeType = "df87f15a-6950-4733-81d0-b638bb06f310";
    await DB.getInstance()
      .getPool()
      .query(
        "INSERT INTO assoc_edge_config (edge_type, edge_name, edge_table, symmetric_edge, inverse_edge_type, created_at, updated_at) VALUES ($1, 'probe child', 'scoped_account_edges', false, NULL, now(), now())",
        [edgeType],
      );
    await withTransaction(async () => {
      const parent = edit(await load(owner.id as string), 90);
      parent.getTriggers = () => [
        {
          changeset: async () => {
            const child = new SimpleAction(
              viewer,
              accountSchema,
              new Map<string, any>([
                ["balance", 80],
                ["admin", true],
              ]),
              WriteOperation.Insert,
              null,
            );
            parent.builder.orchestrator.addOutboundEdge(
              child.builder,
              edgeType,
              "ScopedAccount",
            );
            return child.changeset();
          },
        },
      ];
      await parent.validX();
      await parent.validX();
      await parent.saveX();
    });
    const edges = await loadEdges({ id1: owner.id, edgeType, context });
    expect(edges).toHaveLength(1);
    expect((await load(edges[0].id2 as string)).data.balance).toBe(80);
    expect(
      (await DB.getInstance().getPool().query("SELECT * FROM scoped_accounts"))
        .rowCount,
    ).toBe(2);
  });

  test.each(["valid", "validX", "validWithErrors"] as const)(
    "%s does not transform already-transformed action input twice",
    async (method) => {
      const owner = await create();
      await withTransaction(async () => {
        const parent = edit(await load(owner.id as string), 90);
        Object.assign(parent, {
          transformWrite: ({
            op,
            input,
          }: {
            op: SQLStatementOperation;
            input: { balance: number };
          }) => ({
            op,
            data: { balance: input.balance + 1 },
          }),
        });
        await parent[method]();
        await parent[method]();
        await parent.saveX();
      });
      expect((await load(owner.id as string)).data.balance).toBe(91);
    },
  );

  test("validation preserves previously read builder IDs and defaults", async () => {
    let defaults = 0;
    const schema = getBuilderSchemaFromFields(
      {
        balance: IntegerType({
          defaultValueOnCreate: () => {
            defaults++;
            return 42;
          },
        }),
        admin: BooleanType(),
      },
      ScopedAccount,
    );
    await withTransaction(async () => {
      const action = new GuardedEdit(
        viewer,
        schema,
        new Map([["admin", true]]),
        WriteOperation.Insert,
        null,
      );
      const before = await action.builder.orchestrator.getEditedData();
      await action.validX();
      await action.validX();
      const result = await action.saveX();
      expect(result.id).toBe(before.id);
      expect(result.data.balance).toBe(before.balance);
      expect(defaults).toBe(1);
    });
  });

  test("validation preserves inverse edges established by default-field updateInput", async () => {
    const target = await create();
    const edgeType = "046b59f0-0d2d-431b-ae28-a2ea845acb15";
    await DB.getInstance()
      .getPool()
      .query(
        "INSERT INTO assoc_edge_config (edge_type, edge_name, edge_table, symmetric_edge, inverse_edge_type, created_at, updated_at) VALUES ($1, 'default inverse', 'scoped_account_edges', false, NULL, now(), now())",
        [edgeType],
      );
    let owner!: ScopedAccount;
    await withTransaction(async () => {
      const schema = getBuilderSchemaFromFields(
        {
          balance: IntegerType({ defaultValueOnCreate: () => 42 }),
          admin: BooleanType(),
        },
        ScopedAccount,
      );
      const action = new GuardedEdit(
        viewer,
        schema,
        new Map([["admin", true]]),
        WriteOperation.Insert,
        null,
      );
      const orchestration = action.builder.orchestrator;
      const opts = orchestration.__getOptions();
      const updateInput = opts.updateInput!;
      // Generated builders can add inverse edges while applying defaults.
      opts.updateInput = (input) => {
        updateInput(input);
        orchestration.addOutboundEdge(target.id, edgeType, target.nodeType);
      };
      await action.validX();
      await action.validX();
      owner = await action.saveX();
    });
    expect(
      (await loadEdges({ id1: owner.id, edgeType, context })).map(
        (edge) => edge.id2,
      ),
    ).toEqual([target.id]);
  });

  test("scoped transform factories preserve their receiver and synchronous changesets", async () => {
    const owner = await create();
    await withTransaction(async () => {
      const parent = edit(await load(owner.id as string), 90);
      Object.assign(parent, {
        transformWrite: ({ op }: { op: SQLStatementOperation }) => ({
          op,
          message: "bound transform",
          changeset() {
            return EntChangeset.changesetFromQueries(parent.builder, [
              {
                query:
                  "INSERT INTO scoped_audits (id, created_at, updated_at, message) VALUES ($1, now(), now(), $2)",
                values: [owner.id, this.message],
              },
            ]);
          },
        }),
      });
      await parent.validX();
      await parent.saveX();
    });
    expect((await audits()).rows.map((row) => row.message)).toEqual([
      "bound transform",
    ]);
  });

  test("public validation preserves an unguarded parent's ancestry", async () => {
    const [owner, target] = await Promise.all([create(), create()]);
    await withTransaction(async () => {
      const parent = new SimpleAction(
        viewer,
        accountSchema,
        new Map([["balance", 90]]),
        WriteOperation.Edit,
        await load(owner.id as string),
      );
      parent.getTriggers = () => [
        {
          changeset: async () =>
            edit(await load(target.id as string), 80).changeset(),
        },
      ];
      await parent.validX();
      await parent.saveX();
    });
    expect((await load(owner.id as string)).data.balance).toBe(90);
    expect((await load(target.id as string)).data.balance).toBe(80);
  });

  test.each(["valid", "validX", "validWithErrors"] as const)(
    "%s applies the ancestor conflict guard before preparing overlapping children",
    async (method) => {
      const [owner, target] = await Promise.all([create(), create()]);
      await expect(
        withTransaction(async () => {
          const parent = edit(await load(owner.id as string), 90);
          parent.getTriggers = () => [
            {
              changeset: async () =>
                edit(await load(target.id as string), 80).changeset(),
            },
          ];
          await expect(parent[method]()).rejects.toThrow(
            "overlapping guarded action preparation branches",
          );
        }),
      ).rejects.toThrow("overlapping guarded action preparation branches");
      expect((await load(owner.id as string)).data.balance).toBe(100);
      expect((await load(target.id as string)).data.balance).toBe(100);
    },
  );

  test("saving while public validation is pending fails closed", async () => {
    const owner = await create();
    await expect(
      withTransaction(async () => {
        const parent = edit(await load(owner.id as string), 90);
        const started = deferred();
        const finish = deferred();
        parent.getValidators = () => [
          {
            async validate() {
              started.resolve();
              await finish.promise;
            },
          },
        ];
        const validation = parent.validX();
        await started.promise;
        try {
          await expect(parent.saveX()).rejects.toThrow(
            "preparation is already in progress",
          );
        } finally {
          finish.resolve();
          await validation;
        }
      }),
    ).rejects.toThrow("preparation is already in progress");
    expect((await load(owner.id as string)).data.balance).toBe(100);
  });

  test.each([true, false])(
    "default wildcard conflicts with keyed sibling regardless preparation order (%s)",
    async (keyedFirst) => {
      const accounts = await Promise.all([create(), create(), create()]);
      await expect(
        withTransaction(async () => {
          const current = await Promise.all(
            accounts.map((account) => load(account.id as string)),
          );
          const parent = new SimpleAction(
            viewer,
            accountSchema,
            new Map([["balance", 90]]),
            WriteOperation.Edit,
            current[0],
          );
          parent.getTriggers = () => [
            {
              async changeset() {
                const keyed = independent(
                  edit(current[1], 80),
                  `account:${current[1].id}`,
                );
                const wildcard = edit(current[2], 70);
                const children = keyedFirst
                  ? [keyed, wildcard]
                  : [wildcard, keyed];
                return [
                  await children[0].changeset(),
                  await children[1].changeset(),
                ];
              },
            },
          ];
          await parent.saveX();
        }),
      ).rejects.toThrow("overlapping guarded action preparation branches");
    },
  );
});
