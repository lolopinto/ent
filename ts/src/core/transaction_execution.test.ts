import DB, { Dialect } from "./db";
import { withTransaction } from "./transaction";
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
  test.each([
    "changeset",
    "list executor",
    "complex executor",
    "executeOperations",
    "iterator",
  ])(
    "stale %s rejects before preFetch and rolls back even when caught",
    async (mode) => {
      const owner = await create(),
        other = await create();
      let prefetched = false;
      await expect(
        withTransaction(async () => {
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
          if (executor) {
            const before = executor.preFetch?.bind(executor);
            executor.preFetch = async (...args) => {
              prefetched = true;
              return before?.(...args);
            };
          }
          await new Guarded(
            viewer,
            schema,
            new Map([["balance", 80]]),
            WriteOperation.Edit,
            first,
          ).saveX();
          const execute = async () => {
            if (mode === "iterator") return executor!.next();
            if (mode === "executeOperations")
              return executeOperations(executor!);
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
    },
  );
  test.each(["list", "complex", "Transaction"])(
    "same-generation ordinary %s batch and postcommit results remain supported",
    async (mode) => {
      const owner = await create(),
        other = await create();
      let observations = 0;
      const retained = await withTransaction(async () => {
        const first = edit(await load(owner.id as string), 70);
        const second = edit(await load(other.id as string), 60);
        first.getObservers = () => [
          {
            observe: async () => {
              observations++;
              expect((await first.editedEntX()).data.balance).toBe(70);
            },
          },
        ];
        if (mode === "Transaction")
          await new Transaction(viewer, [first, second]).run();
        else {
          if (mode === "complex")
            first.getTriggers = () => [{ changeset: () => second.changeset() }];
          await (await first.changeset()).executor().execute();
          if (mode === "list")
            await (await second.changeset()).executor().execute();
        }
        return first;
      });
      expect((await retained.editedEntX()).data.balance).toBe(70);
      expect(observations).toBe(1);
      expect((await load(other.id as string)).data.balance).toBe(60);
    },
  );
  test("ordinary changeset preparation cannot finish after a guarded save", async () => {
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
      withTransaction(async () => {
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
        const prepared = action.changeset();
        const checked = expect(prepared).rejects.toThrow(
          "cannot cross transaction generations",
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
        }
        await checked;
      }),
    ).rejects.toThrow("cannot cross transaction generations");
    expect((await load(owner.id as string)).data.balance).toBe(100);
  });
});
