import DB, { Dialect } from "./db";
import { ScopeValidationContext, withTransactionScope } from "./transaction";
import { loadEntX, loadRows } from "./ent";
import { Eq } from "./clause";
import { CustomClauseQuery } from "./query/custom_clause_query";
import { Allow, Deny } from "./base";
import { ObjectLoaderFactory } from "./loaders";
import { BooleanType, IntegerType } from "../schema";
import { WriteOperation } from "../action/action";
import { AlwaysDenyPrivacyPolicy } from "./privacy";
import { TestContext } from "../testutils/context/test_context";
import { setupPostgres, getSchemaTable } from "../testutils/db/temp_db";
import {
  BaseEnt,
  SimpleAction,
  getBuilderSchemaFromFields,
  getDbFields,
} from "../testutils/builder";

class FinalAccount extends BaseEnt {
  nodeType = "FinalAccount";
}
const schema = getBuilderSchemaFromFields(
  { amount: IntegerType(), admin: BooleanType() },
  FinalAccount,
);
const context = new TestContext();
const viewer = context.getViewer();
const loaderOptions = {
  tableName: "final_accounts",
  fields: getDbFields(schema),
  key: "id",
};
const options = {
  ...loaderOptions,
  ent: FinalAccount,
  loaderFactory: new ObjectLoaderFactory(loaderOptions),
};
const load = (id: string) => loadEntX(viewer, id, options);
const make = (amount = 10, admin = true, ent: FinalAccount | null = null) =>
  new SimpleAction(
    viewer,
    schema,
    new Map<string, any>([
      ["amount", amount],
      ["admin", admin],
    ]),
    ent ? WriteOperation.Edit : WriteOperation.Insert,
    ent,
  );
const checked = (
  action: SimpleAction<FinalAccount>,
  validateBeforeCommit: (
    context: ScopeValidationContext,
  ) => Promise<void> | void,
) => Object.assign(action, { validateBeforeCommit });
const rows = () =>
  DB.getInstance()
    .getPool()
    .query("SELECT amount, admin FROM final_accounts ORDER BY amount");
const adminCheck = async (ctx: ScopeValidationContext) => {
  const result = await ctx.query(
    "SELECT count(*)::int AS count FROM final_accounts WHERE admin",
  );
  if (!result.rows[0].count) {
    throw new Error("an administrator must remain");
  }
};

setupPostgres(() => [getSchemaTable(schema, Dialect.Postgres)]);
beforeEach(() => context.cache.reset());

test.each([
  "saveX",
  "builder",
  "changeset",
] as const)("%s registers final validation automatically", async (entry) => {
  const order: string[] = [];
  await withTransactionScope(async () => {
    const action = checked(make(), async (ctx) => {
      order.push("validate");
      expect(
        (await ctx.query("SELECT amount FROM final_accounts")).rows,
      ).toEqual([{ amount: 10 }]);
    });
    action.getObservers = () => [
      {
        observe: () => {
          order.push("observe");
        },
      },
    ];
    if (entry === "builder") {
      await action.builder.saveX();
    } else if (entry === "changeset") {
      await (await action.changeset()).executor().execute();
    } else {
      await action.saveX();
    }
    order.push("saved");
    expect(order).toEqual(["saved"]);
  });
  expect(order).toEqual(["saved", "validate", "observe"]);
});

test.each([
  "saveX",
  "builder",
  "changeset",
  "validX",
] as const)("%s rejects a final validator outside a scope before preparation", async (entry) => {
  const prepare = jest.fn();
  const check = jest.fn();
  const action = checked(make(), check);
  action.getTriggers = () => [{ changeset: prepare }];
  await expect(
    entry === "builder" ? action.builder.saveX() : action[entry](),
  ).rejects.toThrow("requires withTransactionScope");
  expect(prepare).not.toHaveBeenCalled();
  expect(check).not.toHaveBeenCalled();
  expect((await rows()).rows).toEqual([]);
});

test("overlapping child decisions roll back when final validation fails", async () => {
  const first = await make(1).saveX();
  const second = await make(2).saveX();
  const observe = jest.fn();
  await expect(
    withTransactionScope(async () => {
      const parent = make(3, false);
      parent.getTriggers = () =>
        [first.id, second.id].map((id) => ({
          changeset: async () => {
            const child = checked(
              make(4, false, await load(id as string)),
              adminCheck,
            );
            child.getObservers = () => [{ observe }];
            return child.changeset();
          },
        }));
      await parent.saveX();
    }),
  ).rejects.toThrow("an administrator must remain");
  expect((await rows()).rows).toEqual([
    { amount: 1, admin: true },
    { amount: 2, admin: true },
  ]);
  expect(observe).not.toHaveBeenCalled();
});

test("an action's final check includes later roots and permits administrator replacement", async () => {
  const before = await make().saveX();
  await withTransactionScope(async () => {
    await checked(
      make(10, false, await load(before.id as string)),
      adminCheck,
    ).saveX();
    await make(20, true).saveX();
  });
  expect((await rows()).rows).toEqual([
    { amount: 10, admin: false },
    { amount: 20, admin: true },
  ]);
});

test("grandchildren register their checks even when parents have no scope requirement", async () => {
  const calls: string[] = [];
  await withTransactionScope(async () => {
    const parent = make(1);
    parent.getTriggers = () => [
      {
        changeset: async () => {
          const child = make(2);
          child.getTriggers = () => [
            {
              changeset: () =>
                checked(make(3), async (ctx) => {
                  calls.push("grandchild");
                  expect(
                    (
                      await ctx.query(
                        "SELECT count(*)::int AS count FROM final_accounts",
                      )
                    ).rows[0].count,
                  ).toBe(3);
                }).changeset(),
            },
          ];
          return child.changeset();
        },
      },
    ];
    await parent.saveX();
    expect(calls).toEqual([]);
  });
  expect(calls).toEqual(["grandchild"]);
});

test.each([
  "valid",
  "validX",
  "validWithErrors",
] as const)("%s does not retain checks from discarded children", async (entry) => {
  const check = jest.fn();
  await withTransactionScope(async () => {
    const parent = make();
    parent.getTriggers = () => [
      { changeset: () => checked(make(2), check).changeset() },
    ];
    await parent[entry]();
    parent.getTriggers = () => [];
    await parent.saveX();
  });
  expect(check).not.toHaveBeenCalled();
  expect((await rows()).rows).toEqual([{ amount: 10, admin: true }]);
});

test("an unexecuted changeset does not register its final check", async () => {
  const check = jest.fn();
  await withTransactionScope(() => checked(make(), check).changeset());
  expect(check).not.toHaveBeenCalled();
  expect((await rows()).rows).toEqual([]);
});

test("silent privacy failures do not register final checks", async () => {
  const original = await make().saveX();
  const check = jest.fn();
  await withTransactionScope(async () => {
    const action = checked(
      make(20, true, await load(original.id as string)),
      check,
    );
    action.getPrivacyPolicy = () => AlwaysDenyPrivacyPolicy;
    action.__failPrivacySilently = () => true;
    await action.saveX();
  });
  expect(check).not.toHaveBeenCalled();
  expect((await rows()).rows).toEqual([{ amount: 10, admin: true }]);
});

test("retries recreate registrations and observers only run for the committed attempt", async () => {
  const attempts: number[] = [];
  const observe = jest.fn();
  await withTransactionScope(
    async (scope) => {
      const action = checked(make(scope.attempt), async (ctx) => {
        attempts.push(ctx.attempt);
        if (ctx.attempt === 0) {
          throw Object.assign(new Error("serialization conflict"), {
            code: "40001",
          });
        }
      });
      action.getObservers = () => [{ observe }];
      await action.saveX();
    },
    { maxRetries: 1 },
  );
  expect(attempts).toEqual([0, 1]);
  expect(observe).toHaveBeenCalledTimes(1);
  expect((await rows()).rows).toEqual([{ amount: 1, admin: true }]);
});

test("business validation failures are not retried", async () => {
  const check = jest.fn(() => {
    throw new Error("invalid final state");
  });
  await expect(
    withTransactionScope(() => checked(make(), check).saveX(), {
      maxRetries: 3,
    }),
  ).rejects.toThrow("invalid final state");
  expect(check).toHaveBeenCalledTimes(1);
  expect((await rows()).rows).toEqual([]);
});

test("final validation bypasses request caches, loader caches, and query caches", async () => {
  const original = await make().saveX();
  await load(original.id as string);
  const db = DB.getInstance();
  const acquire = db.getNewClient.bind(db);
  let reads = 0;
  const acquireSpy = jest
    .spyOn(db, "getNewClient")
    .mockImplementation(async () => {
      const client = await acquire();
      const query = client.query.bind(client);
      client.query = (sql, values) => {
        if (/^SELECT/i.test(sql)) {
          reads++;
        }
        return query(sql, values);
      };
      return client;
    });
  try {
    await withTransactionScope(async () => {
      const action = checked(
        make(20, true, await load(original.id as string)),
        async (ctx) => {
          const start = reads;
          const first = await load(original.id as string);
          const second = await load(original.id as string);
          expect(first.data.amount).toBe(20);
          expect(second.data.amount).toBe(20);
          expect(second).not.toBe(first);
          const loader = options.loaderFactory.createLoader(context);
          expect((await loader.load(original.id))?.amount).toBe(20);
          expect((await loader.load(original.id))?.amount).toBe(20);
          const queryOptions = {
            ...loaderOptions,
            context,
            clause: Eq("id", original.id),
          };
          expect((await loadRows(queryOptions))[0].amount).toBe(20);
          expect((await loadRows(queryOptions))[0].amount).toBe(20);
          expect(
            (
              await ctx.query(
                "SELECT amount FROM final_accounts WHERE id = $1",
                [original.id],
              )
            ).rows[0].amount,
          ).toBe(20);
          expect(reads - start).toBe(7);
          const edgeQuery = new CustomClauseQuery(viewer, {
            loadEntOptions: options,
            clause: Eq("id", original.id),
            name: "final-account",
          });
          for (const read of [
            () => edgeQuery.queryEnts(),
            () => edgeQuery.queryCount(),
            () => edgeQuery.queryRawCount(),
          ]) {
            const before = reads;
            await read();
            const queried = reads;
            expect(queried).toBeGreaterThan(before);
            await read();
            expect(reads).toBeGreaterThan(queried);
          }
        },
      );
      await action.saveX();
    });
  } finally {
    acquireSpy.mockRestore();
  }
});

test.each([
  "UPDATE final_accounts SET amount = 99",
  "WITH changed AS (DELETE FROM final_accounts RETURNING *) SELECT * FROM changed",
  "SELECT 1; COMMIT",
  "COMMIT",
  "SELECT * INTO copied FROM final_accounts",
  "SELECT * FROM final_accounts FOR UPDATE",
])("caught validation SQL violation rolls back: %s", async (sql) => {
  let failure: unknown;
  await expect(
    withTransactionScope(() =>
      checked(make(), async (ctx) => {
        try {
          await ctx.query(sql);
        } catch (error) {
          failure = error;
        }
      }).saveX(),
    ),
  ).rejects.toThrow("single read query");
  expect(failure).toBeInstanceOf(Error);
  expect((await rows()).rows).toEqual([]);
});

test("PostgreSQL blocks writes hidden in a function called by a validation query", async () => {
  await DB.getInstance()
    .getPool()
    .query(
      "CREATE FUNCTION change_final_amount() RETURNS integer LANGUAGE plpgsql AS $$ BEGIN UPDATE final_accounts SET amount = 99; RETURN 1; END $$",
    );
  await expect(
    withTransactionScope(() =>
      checked(make(), async (ctx) => {
        await ctx.query("SELECT change_final_amount()");
      }).saveX(),
    ),
  ).rejects.toThrow("read-only transaction");
  expect((await rows()).rows).toEqual([]);
});

test.each([
  "saveX",
  "validX",
] as const)("caught %s calls during final validation fail the scope", async (entry) => {
  await expect(
    withTransactionScope(() =>
      checked(make(), async () => {
        await expect(make(99)[entry]()).rejects.toThrow(
          "during scope validation",
        );
      }).saveX(),
    ),
  ).rejects.toThrow("during scope validation");
  expect((await rows()).rows).toEqual([]);
});

test("a retained validation context cannot query after the scope closes", async () => {
  let retained!: ScopeValidationContext;
  await withTransactionScope(() =>
    checked(make(), (ctx) => {
      retained = ctx;
    }).saveX(),
  );
  expect(() => retained.query("SELECT 1")).toThrow("outside its callback");
});

test("a validator cannot reuse a loader prepared before final validation", async () => {
  await expect(
    withTransactionScope(async () => {
      const loader = options.loaderFactory.createLoader(context);
      await checked(make(), async () => {
        await loader.load("missing");
      }).saveX();
    }),
  ).rejects.toThrow("cannot cross transaction generations");
  expect((await rows()).rows).toEqual([]);
});

test("fresh Ent reads enforce privacy again during final validation", async () => {
  let allowed = true;
  const privacy = jest.fn(async () => (allowed ? Allow() : Deny()));
  class PrivateAccount extends FinalAccount {
    getPrivacyPolicy() {
      return { rules: [{ apply: privacy }] };
    }
  }
  const privateLoad = (id: string) =>
    loadEntX(viewer, id, { ...options, ent: PrivateAccount });
  const original = await make().saveX();
  await privateLoad(original.id as string);
  await expect(
    withTransactionScope(() =>
      checked(make(), async () => {
        allowed = false;
        await privateLoad(original.id as string);
      }).saveX(),
    ),
  ).rejects.toThrow();
  expect(privacy).toHaveBeenCalledTimes(2);
  expect((await rows()).rows).toHaveLength(1);
});

test("deferred foreign keys and database trigger writes finish before final validation", async () => {
  const pool = DB.getInstance().getPool();
  await pool.query(
    "CREATE TABLE final_refs (account_id uuid REFERENCES final_accounts(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED)",
  );
  await pool.query(
    "CREATE FUNCTION add_final_reference() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO final_refs VALUES (NEW.id); UPDATE final_accounts SET amount = amount + 1 WHERE id = NEW.id; RETURN NULL; END $$",
  );
  await pool.query(
    "CREATE CONSTRAINT TRIGGER final_reference AFTER INSERT ON final_accounts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION add_final_reference()",
  );
  await withTransactionScope(() =>
    checked(make(), async (ctx) => {
      expect(
        (await ctx.query("SELECT amount FROM final_accounts")).rows,
      ).toEqual([{ amount: 11 }]);
      expect(
        (await ctx.query("SELECT count(*)::int AS count FROM final_refs"))
          .rows[0].count,
      ).toBe(1);
    }).saveX(),
  );
  expect((await rows()).rows).toEqual([{ amount: 11, admin: true }]);
  await pool.query("DROP TRIGGER final_reference ON final_accounts");
  await pool.query("DROP FUNCTION add_final_reference()");
  await pool.query("DROP TABLE final_refs");
});

test("an unawaited validation query aborts and drains before releasing the connection", async () => {
  let pending!: Promise<unknown>;
  await expect(
    withTransactionScope(() =>
      checked(make(), (ctx) => {
        pending = ctx.query("SELECT pg_sleep(0.02)").catch((error) => error);
      }).saveX(),
    ),
  ).rejects.toThrow("await all reads during scope validation");
  expect(await pending).toBeInstanceOf(Error);
  expect((await rows()).rows).toEqual([]);
});

test("an unawaited save cannot enter final validation or commit", async () => {
  let release!: () => void;
  let started!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const beginning = new Promise<void>((resolve) => {
    started = resolve;
  });
  const check = jest.fn();
  let saving!: Promise<unknown>;
  const outcome = withTransactionScope(async () => {
    await checked(make(), check).saveX();
    const action = make(20);
    action.getTriggers = () => [
      {
        changeset: async () => {
          started();
          await gate;
        },
      },
    ];
    saving = action.saveX().catch((error) => error);
    await beginning;
  }).catch((error) => error);
  await beginning;
  await new Promise<void>((resolve) => setImmediate(resolve));
  release();
  expect(await outcome).toMatchObject({
    message: expect.stringContaining("await each action save"),
  });
  expect(await saving).toBeInstanceOf(Error);
  expect(check).not.toHaveBeenCalled();
  expect((await rows()).rows).toEqual([]);
});

test("scope validation waits for action result privacy before it can commit", async () => {
  let started!: () => void;
  let release!: () => void;
  const start = new Promise<void>((resolve) => {
    started = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const check = jest.fn();
  let saving!: Promise<unknown>;
  let finished = false;
  const outcome = withTransactionScope(async () => {
    const action = checked(make(), check);
    Object.assign(action, {
      viewerForEntLoad: async () => {
        started();
        await gate;
        return viewer;
      },
    });
    saving = action.saveX().catch((error) => error);
    await start;
  }).then(
    () => {
      finished = true;
    },
    (error) => error,
  );
  await start;
  await new Promise<void>((resolve) => setTimeout(resolve, 20));
  const committedEarly = finished;
  release();
  const failure = await outcome;
  await saving;
  expect(committedEarly).toBe(false);
  expect(failure).toMatchObject({
    message: expect.stringContaining("await each action save"),
  });
  expect(check).not.toHaveBeenCalled();
  expect((await rows()).rows).toEqual([]);
});

test("repeated custom edge counts do not accumulate source identifiers", async () => {
  const account = await make().saveX();
  await withTransactionScope(() =>
    checked(make(), async () => {
      const { CustomEdgeQueryBase } = await import("./query/custom_query");
      class AccountQuery extends CustomEdgeQueryBase<
        FinalAccount,
        FinalAccount
      > {
        async sourceEnt() {
          return null;
        }
      }
      const query = new AccountQuery(viewer, {
        src: account.id,
        groupCol: "id",
        loadEntOptions: options,
        name: "final-count",
      });
      expect(await query.queryRawCount()).toBe(1);
      expect(await query.queryRawCount()).toBe(1);
      expect(await query.queryCount()).toBe(1);
      expect(await query.queryCount()).toBe(1);
    }).saveX(),
  );
});

test("conditional wrappers preserve silent privacy skips for final validation", async () => {
  const account = await make().saveX();
  const check = jest.fn(() => {
    throw new Error("skipped rule must not run");
  });
  await withTransactionScope(async () => {
    const parent = make(20);
    parent.getTriggers = () => [
      {
        changeset: async () => {
          const child = checked(
            make(30, true, await load(account.id as string)),
            check,
          );
          child.getPrivacyPolicy = () => AlwaysDenyPrivacyPolicy;
          child.__failPrivacySilently = () => true;
          return child.changesetWithOptions_BETA({
            conditionalBuilder: parent.builder,
          });
        },
      },
    ];
    await parent.saveX();
  });
  expect(check).not.toHaveBeenCalled();
  expect((await rows()).rows).toEqual([
    { amount: 10, admin: true },
    { amount: 20, admin: true },
  ]);
});

test("a failing final check preserves its error while draining an unawaited read", async () => {
  const error = new Error("invalid final business state");
  let pending!: Promise<unknown>;
  await expect(
    withTransactionScope(() =>
      checked(make(), (context) => {
        pending = context
          .query("SELECT pg_sleep(0.02)")
          .catch((error) => error);
        throw error;
      }).saveX(),
    ),
  ).rejects.toBe(error);
  await pending;
  expect((await rows()).rows).toEqual([]);
});

test("serializable final checks coordinate concurrent administrator removals", async () => {
  const accounts = await Promise.all([make(1).saveX(), make(2).saveX()]);
  let arrive!: () => void;
  const bothRead = new Promise<void>((resolve) => {
    arrive = resolve;
  });
  let readers = 0;
  const attempts: number[] = [];
  const outcomes = await Promise.allSettled(
    accounts.map((account) =>
      withTransactionScope(
        async (scope) => {
          attempts.push(scope.attempt);
          await checked(
            make(account.data.amount, false, await load(account.id as string)),
            async (context) => {
              const count = (
                await context.query(
                  "SELECT count(*)::int AS count FROM final_accounts WHERE admin",
                )
              ).rows[0].count;
              if (scope.attempt === 0) {
                if (++readers === 2) {
                  arrive();
                }
                await bothRead;
              }
              if (!count) {
                throw new Error("an administrator must remain");
              }
            },
          ).saveX();
        },
        { maxRetries: 2 },
      ),
    ),
  );
  expect(
    outcomes.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(1);
  expect(outcomes.filter((result) => result.status === "rejected")).toEqual([
    { status: "rejected", reason: new Error("an administrator must remain") },
  ]);
  expect(attempts).toContain(1);
  expect((await rows()).rows.filter((row) => row.admin)).toHaveLength(1);
});

test("work inherited from the callback cannot write during final validation", async () => {
  let finalStarted!: () => void;
  const start = new Promise<void>((resolve) => {
    finalStarted = resolve;
  });
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let late!: Promise<unknown>;
  await expect(
    withTransactionScope(async (scope) => {
      late = start.then(async () => {
        try {
          await scope.query("UPDATE final_accounts SET amount = 0");
        } catch (error) {
          return error;
        } finally {
          finish();
        }
      });
      await checked(make(), async () => {
        finalStarted();
        await gate;
      }).saveX();
    }),
  ).rejects.toThrow("transaction callback is closed");
  expect(await late).toBeInstanceOf(Error);
  expect((await rows()).rows).toEqual([]);
});
