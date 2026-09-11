import DB, { Dialect } from "./db";
import { withTransactionScope } from "./transaction";
import { runActionChangeset } from "../action";
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
import { executeOperations } from "../action/executor";
import { Transaction } from "../action/transaction";
import { ObjectLoaderFactory } from "./loaders";
import { loadEntX } from "./ent";
class ExecutionAccount extends BaseEnt {
  nodeType = "ExecutionAccount";
}
const schema = getBuilderSchemaFromFields(
  { balance: IntegerType() },
  ExecutionAccount,
);
const loaderOptions = {
  tableName: "execution_accounts",
  fields: getDbFields(schema),
  key: "id",
};
const options = {
  ...loaderOptions,
  ent: ExecutionAccount,
  loaderFactory: new ObjectLoaderFactory(loaderOptions),
};
const context = new TestContext();
const viewer = context.getViewer();
const load = (id: string) => loadEntX(viewer, id, options);
class Guarded extends SimpleAction<ExecutionAccount> {
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
const edit = (ent: ExecutionAccount, balance: number) =>
  new SimpleAction(
    viewer,
    schema,
    new Map([["balance", balance]]),
    WriteOperation.Edit,
    ent,
  );

describe("transaction execution preparation generations", () => {
  setupPostgres(() => [getSchemaTable(schema, Dialect.Postgres)]);
  beforeEach(() => context.cache.reset());
  test("caught changeset setup failure aborts earlier writes", async () => {
    const owner = await create();
    const failure = new Error("edge setup failed");
    await expect(
      withTransactionScope(async (tx) => {
        await tx.exec(
          "UPDATE execution_accounts SET balance = 80 WHERE id = $1",
          [owner.id],
        );
        await expect(
          runActionChangeset(async () => {
            throw failure;
          }),
        ).rejects.toBe(failure);
      }),
    ).rejects.toBe(failure);
    expect((await load(owner.id as string)).data.balance).toBe(100);
  });

  test("standalone validation can recover from child changeset validation errors", async () => {
    const owner = await create();
    const failure = new Error("correctable child validation failed");
    await withTransactionScope(async () => {
      const action = edit(await load(owner.id as string), 80);
      action.getTriggers = () => [
        {
          changeset: () =>
            runActionChangeset(async () => {
              const child = edit(await load(owner.id as string), 70);
              child.getValidators = () => [{ validate: () => failure }];
              return child.changeset();
            }),
        },
      ];
      await expect(action.validX()).rejects.toBe(failure);
      action.getTriggers = () => [];
      await action.saveX();
    });
    expect((await load(owner.id as string)).data.balance).toBe(80);
  });
  test.each([
    "valid",
    "validX",
    "validWithErrors",
    "outside",
    "previous",
  ] as const)(
    "caught executor assembly failure from %s preparation aborts earlier writes",
    async (source) => {
      const owner = await create();
      const other = await create();
      let captured!: Awaited<
        ReturnType<SimpleAction<ExecutionAccount>["changeset"]>
      >;
      let failure: unknown;
      const prepare = async () =>
        edit(await load(other.id as string), 70).changeset();
      if (source === "outside") {
        captured = await prepare();
      } else if (source === "previous") {
        captured = await withTransactionScope(prepare);
      }
      const outcome = withTransactionScope(async () => {
        if (source !== "outside" && source !== "previous") {
          const probe = edit(await load(owner.id as string), 90);
          probe.getTriggers = () => [
            {
              changeset: async () => {
                captured = await prepare();
                return captured;
              },
            },
          ];
          await probe[source]();
        }
        await edit(await load(owner.id as string), 80).saveX();
        try {
          captured.executor();
        } catch (error) {
          failure = error;
        }
        expect(failure).toBeInstanceOf(Error);
        expect(failure).toMatchObject({
          message: expect.stringContaining(
            source === "outside" || source === "previous"
              ? "loaders cannot cross transaction scopes"
              : "changesets prepared by public validation cannot execute",
          ),
        });
      });
      const result = await outcome.then(
        () => undefined,
        (error: unknown) => error,
      );
      const balance = (await load(owner.id as string)).data.balance;
      expect({ rejectedWithOriginalError: result === failure, balance }).toEqual({
        rejectedWithOriginalError: true,
        balance: 100,
      });
    },
  );
  test.each([
    "changeset",
    "list executor",
    "complex executor",
    "executeOperations",
    "iterator",
  ])("stale %s rejects before preFetch and rolls back even when caught", async (mode) => {
    const owner = await create(),
      other = await create();
    let prefetched = false;
    await expect(
      withTransactionScope(async () => {
        const first = await load(owner.id as string);
        const retained = edit(first, first.data.balance - 30);
        if (mode === "complex executor") {
          const second = await load(other.id as string);
          retained.getTriggers = () => [
            { changeset: () => edit(second, 70).changeset() },
          ];
        }
        const changeset = await retained.changeset();
        const executor =
          mode === "changeset" ? undefined : changeset.executor();
        await (executor ?? changeset.executor()).execute();
        if (executor) {
          const before = executor.preFetch?.bind(executor);
          executor.preFetch = async (...args) => {
            prefetched = true;
            return before?.(...args);
          };
        }
        const execute = async () => {
          if (mode === "iterator") {
            return executor!.next();
          }
          if (mode === "executeOperations") {
            return executeOperations(executor!);
          }
          return (executor ?? changeset.executor()).execute();
        };
        await expect(execute()).rejects.toThrow(
          "cannot cross transaction generations",
        );
      }),
    ).rejects.toThrow("cannot cross transaction generations");
    expect(prefetched).toBe(false);
    expect((await load(owner.id as string)).data.balance).toBe(100);
    expect((await load(other.id as string)).data.balance).toBe(100);
  });
  test.each([
    "list",
    "complex",
  ])("ordinary %s saves and postcommit results remain supported", async (mode) => {
    const owner = await create(),
      other = await create();
    let observations = 0;
    const retained = await withTransactionScope(async () => {
      const first = edit(await load(owner.id as string), 70);
      first.getObservers = () => [
        {
          observe: async () => {
            observations++;
            expect((await first.editedEntX()).data.balance).toBe(70);
          },
        },
      ];
      if (mode === "complex") {
        first.getTriggers = () => [
          {
            changeset: async () =>
              edit(await load(other.id as string), 60).changeset(),
          },
        ];
      }
      await (await first.changeset()).executor().execute();
      if (mode === "list") {
        await (await edit(await load(other.id as string), 60).changeset())
          .executor()
          .execute();
      }
      return first;
    });
    expect((await retained.editedEntX()).data.balance).toBe(70);
    expect(observations).toBe(1);
    expect((await load(other.id as string)).data.balance).toBe(60);
  });
  test("Transaction groups cannot prepare multiple roots in a scope", async () => {
    const owner = await create();
    const other = await create();
    await expect(
      withTransactionScope(async () => {
        await new Transaction(viewer, [
          edit(await load(owner.id as string), 70),
          edit(await load(other.id as string), 60),
        ]).run();
      }),
    ).rejects.toThrow("root actions must be prepared and saved sequentially");
    expect((await load(owner.id as string)).data.balance).toBe(100);
    expect((await load(other.id as string)).data.balance).toBe(100);
  });

  test("ordinary preparation reserves the root before another action requires a scope", async () => {
    const owner = await create();
    let start!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => {
      start = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await expect(
      withTransactionScope(async () => {
        const first = await load(owner.id as string);
        const action = edit(first, 70);
        action.getValidators = () => [
          {
            validate: async () => {
              start();
              await gate;
            },
          },
        ];
        const prepared = action.changeset().then(
          (value) => ({ value }),
          (error) => ({ error }),
        );
        await started;
        try {
          await new Guarded(
            viewer,
            schema,
            new Map([["balance", 80]]),
            WriteOperation.Edit,
            first,
          ).saveX();
        } finally {
          release();
          await prepared;
        }
      }),
    ).rejects.toThrow("root actions must be prepared and saved sequentially");
    expect((await load(owner.id as string)).data.balance).toBe(100);
  });
});
