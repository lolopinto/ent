import DB, { Dialect } from "./db";
import { withTransaction } from "./transaction";
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

class ResourceReservation extends BaseEnt {
  nodeType = "ResourceReservation";
}
const schema = getBuilderSchemaFromFields(
  { amount: IntegerType() },
  ResourceReservation,
);
const context = new TestContext();
const viewer = context.getViewer();
const options = {
  tableName: "resource_reservations",
  fields: getDbFields(schema),
  context,
};
class Guarded extends SimpleAction<ResourceReservation> {
  requiresTransaction() {
    return true;
  }
}
const create = (amount = 1) =>
  new Guarded(
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
  DB.getInstance().getPool().query("SELECT amount FROM resource_reservations");

setupPostgres(() => [getSchemaTable(schema, Dialect.Postgres)]);
beforeEach(() => context.cache.reset());

describe.each([
  "saveX",
  "builder.saveX",
  "changeset",
  "valid",
  "validX",
  "validWithErrors",
] as const)("%s reserves roots before asynchronous resource resolution", (entry) => {
  test.each([
    "delay only",
    "invariant read",
    "nested validation",
  ])("%s cannot overlap a second guarded root even when caught", async (mode) => {
    const started = deferred();
    const release = deferred();
    const hooks: string[] = [];
    let caught: unknown;
    let outer: unknown;
    try {
      await withTransaction(async () => {
        const make = (delay: boolean) => {
          let count = 0;
          const action = create();
          Object.assign(action, {
            getTransactionResources: async () => {
              hooks.push(delay ? "slow" : "fast");
              if (mode !== "delay only") {
                count = (
                  await loadRows({ ...options, clause: Eq("amount", 1) })
                ).length;
              }
              if (mode === "nested validation") {
                const nested = new SimpleAction(
                  viewer,
                  schema,
                  new Map([["amount", 2]]),
                  WriteOperation.Insert,
                  null,
                );
                await nested.validX();
              }
              if (delay) {
                started.resolve();
                await release.promise;
              }
              return ["single-reservation"];
            },
          });
          action.getValidators = () => [
            {
              validate: async () => {
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
      "guarded root actions must be prepared and saved sequentially",
    );
    expect(outer).toBe(caught);
    expect(hooks).toEqual(["slow"]);
    expect((await rows()).rows).toEqual([]);
  });

  test("a caught delayed resource failure aborts earlier writes", async () => {
    const started = deferred();
    const release = deferred();
    const failure = new Error("resource resolution failed");
    const transaction = withTransaction(async () => {
      await create().saveX();
      const action = create();
      Object.assign(action, {
        getTransactionResources: async () => {
          started.resolve();
          await release.promise;
          throw failure;
        },
      });
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

test.each([
  false,
  true,
])("parallel child resource hooks preserve overlap checks (shared keys: %s)", async (shared) => {
  const bothStarted = deferred();
  let arrivals = 0;
  const transaction = withTransaction(async () => {
    const parent = Object.assign(create(1), {
      getTransactionResources: () => ["parent"],
    });
    const children = [2, 3].map((amount) =>
      Object.assign(create(amount), {
        getTransactionResources: async () => {
          if (++arrivals === 2) {
            bothStarted.resolve();
          }
          await bothStarted.promise;
          return [shared ? "child" : `child:${amount}`];
        },
      }),
    );
    parent.getTriggers = () =>
      children.map((child) => ({ changeset: () => child.changeset() }));
    await parent.saveX();
  });
  if (shared) {
    await expect(transaction).rejects.toThrow(
      "overlapping guarded action preparation branches",
    );
    expect((await rows()).rows).toEqual([]);
  } else {
    await transaction;
    expect((await rows()).rows.map((row) => row.amount).sort()).toEqual([
      1, 2, 3,
    ]);
  }
});
