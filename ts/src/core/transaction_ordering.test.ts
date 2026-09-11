import DB, { Dialect } from "./db";
import { withTransactionScope } from "./transaction";
import { loadRows } from "./ent";
import { Eq } from "./clause";
import { WriteOperation } from "../action/action";
import { IntegerType } from "../schema";
import { setupPostgres, getSchemaTable } from "../testutils/db/temp_db";
import {
  BaseEnt,
  getBuilderSchemaFromFields,
  SimpleAction,
  getDbFields,
} from "../testutils/builder";
import { TestContext } from "../testutils/context/test_context";

class ScopeReservation extends BaseEnt {
  nodeType = "ScopeReservation";
}
const schema = getBuilderSchemaFromFields(
  { amount: IntegerType() },
  ScopeReservation,
);
const context = new TestContext();
const viewer = context.getViewer();
const options = {
  tableName: "scope_reservations",
  fields: getDbFields(schema),
  context,
};
class Scoped extends SimpleAction<ScopeReservation> {
  requiresTransactionScope() {
    return true;
  }
}
const create = (amount = 1) =>
  new Scoped(
    viewer,
    schema,
    new Map([["amount", amount]]),
    WriteOperation.Insert,
    null,
  );
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
const rows = () =>
  DB.getInstance().getPool().query("SELECT amount FROM scope_reservations");

setupPostgres(() => [getSchemaTable(schema, Dialect.Postgres)]);
beforeEach(() => context.cache.reset());

describe.each([
  "saveX",
  "builder.saveX",
  "changeset",
  "valid",
  "validX",
  "validWithErrors",
] as const)("%s reserves roots before asynchronous preparation", (entry) => {
  test.each([
    "delay only",
    "invariant read",
    "nested validation",
  ])("%s cannot overlap a second root even when caught", async (mode) => {
    const started = deferred();
    const release = deferred();
    const hooks: string[] = [];
    let caught: unknown;
    let outer: unknown;
    try {
      await withTransactionScope(async () => {
        const make = (delay: boolean) => {
          let count = 0;
          const action = create();
          action.getTriggers = () => [
            {
              changeset: async () => {
                hooks.push(delay ? "slow" : "fast");
                if (mode !== "delay only") {
                  count = (
                    await loadRows({ ...options, clause: Eq("amount", 1) })
                  ).length;
                }
                if (mode === "nested validation") {
                  await new SimpleAction(
                    viewer,
                    schema,
                    new Map([["amount", 2]]),
                    WriteOperation.Insert,
                    null,
                  ).validX();
                }
                if (delay) {
                  started.resolve();
                  await release.promise;
                }
                if (count >= 1) {
                  throw new Error("already reserved");
                }
              },
            },
          ];
          return action;
        };
        const firstAction = make(true);
        const firstCall =
          entry === "builder.saveX"
            ? firstAction.builder.saveX()
            : firstAction[entry]();
        const first = firstCall.then(
          (value) => ({ value }),
          (error) => ({ error }),
        );
        await started.promise;
        try {
          await make(false).saveX();
        } catch (error) {
          caught = error;
        } finally {
          release.resolve();
          await first;
        }
      });
    } catch (error) {
      outer = error;
    } finally {
      release.resolve();
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(
      "root actions must be prepared and saved sequentially",
    );
    expect(outer).toBe(caught);
    expect(hooks).toEqual(["slow"]);
    expect((await rows()).rows).toEqual([]);
  });

  test("a caught delayed preparation failure aborts earlier writes", async () => {
    const started = deferred();
    const release = deferred();
    const failure = new Error("preparation failed");
    const transaction = withTransactionScope(async () => {
      await create().saveX();
      const action = create();
      action.getTriggers = () => [
        {
          changeset: async () => {
            started.resolve();
            await release.promise;
            throw failure;
          },
        },
      ];
      await expect(
        entry === "builder.saveX" ? action.builder.saveX() : action[entry](),
      ).rejects.toBe(failure);
    });
    const outcome = transaction.then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    try {
      await started.promise;
      release.resolve();
      expect(await outcome).toEqual({ error: failure });
      expect((await rows()).rows).toEqual([]);
    } finally {
      release.resolve();
      await outcome;
    }
  });
});

test("child preparation can run in parallel under one root", async () => {
  const bothStarted = deferred();
  let arrivals = 0;
  await withTransactionScope(async () => {
    const parent = create(1);
    const children = [2, 3].map((amount) => {
      const child = create(amount);
      child.getTriggers = () => [
        {
          changeset: async () => {
            if (++arrivals === 2) {
              bothStarted.resolve();
            }
            await bothStarted.promise;
          },
        },
      ];
      return child;
    });
    parent.getTriggers = () =>
      children.map((child) => ({ changeset: () => child.changeset() }));
    await parent.saveX();
  });
  expect((await rows()).rows.map((row) => row.amount).sort()).toEqual([
    1, 2, 3,
  ]);
});
