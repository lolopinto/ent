import DB, { Dialect } from "./db";
import { withTransaction } from "./transaction";
import { loadRows } from "./ent";
import { Eq } from "./clause";
import { WriteOperation } from "../action/action";
import { BooleanType, IntegerType, SQLStatementOperation } from "../schema";
import { setupPostgres, getSchemaTable } from "../testutils/db/temp_db";
import {
  BaseEnt,
  getBuilderSchemaFromFields,
  SimpleAction,
  getDbFields,
} from "../testutils/builder";
import { TestContext } from "../testutils/context/test_context";

class PreparedAccount extends BaseEnt {
  nodeType = "PreparedAccount";
}
const accountSchema = getBuilderSchemaFromFields(
  { balance: IntegerType(), admin: BooleanType() },
  PreparedAccount,
);
const options = {
  tableName: "prepared_accounts",
  fields: getDbFields(accountSchema),
};
const context = new TestContext();
const viewer = context.getViewer();
class GuardedInsert extends SimpleAction<PreparedAccount> {
  requiresTransaction() {
    return true;
  }
}
const sources = ["default", "action transform"] as const;
function make(
  source: (typeof sources)[number],
  derive: () => number | Promise<number>,
) {
  const transformWrite = async () => ({
    op: SQLStatementOperation.Insert,
    data: { balance: await derive() },
  });
  const schema = getBuilderSchemaFromFields(
    {
      balance: IntegerType(
        source === "default" ? { defaultValueOnCreate: derive } : {},
      ),
      admin: BooleanType(),
    },
    PreparedAccount,
  );
  const action = new GuardedInsert(
    viewer,
    schema,
    new Map<string, any>(
      source === "default"
        ? [["admin", true]]
        : [
            ["admin", true],
            ["balance", 0],
          ],
    ),
    WriteOperation.Insert,
    null,
  );
  if (source === "action transform") {
    Object.assign(action, { transformWrite });
  }
  return action;
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("transaction field preparation generations", () => {
  setupPostgres(() => [getSchemaTable(accountSchema, Dialect.Postgres)]);
  beforeEach(() => context.cache.reset());
  const rows = () =>
    DB.getInstance()
      .getPool()
      .query("SELECT balance FROM prepared_accounts ORDER BY balance");
  test.each(
    sources.flatMap((source) =>
      ["valid", "validX", "validWithErrors", "getter", "privacy getter"].map(
        (entry) => [source, entry] as const,
      ),
    ),
  )(
    "stale %s prepared by %s rejects and rolls back even when caught",
    async (source, entry) => {
      const next = async () =>
        (await loadRows({ ...options, clause: Eq("admin", true), context }))
          .length + 1;
      await expect(
        withTransaction(async () => {
          const retained = make(source, next);
          if (entry === "validX") {
            await retained.validX();
          } else if (entry === "valid") {
            expect(await retained.valid()).toBe(true);
          }
          else if (entry === "validWithErrors") {
            expect(await retained.validWithErrors()).toEqual([]);
          } else if (entry === "privacy getter") {
            await retained.builder.orchestrator.getPossibleUnsafeEntForPrivacy();
          } else {
            await retained.builder.orchestrator.getEditedData();
          }
          await make(source, next).saveX();
          await expect(retained.saveX()).rejects.toThrow(
            "cannot cross transaction generations",
          );
        }),
      ).rejects.toThrow("cannot cross transaction generations");
      expect((await rows()).rows).toEqual([]);
    },
  );
  test.each(sources)(
    "same-generation %s preserves stable ID and one preparation",
    async (source) => {
      let calls = 0;
      const action = await withTransaction(async () => {
        const action = make(source, () => {
          calls++;
          return 42;
        });
        const before = await action.builder.orchestrator.getEditedData();
        await action.validX();
        await action.validX();
        action.viewerForEntLoad = async () => {
          expect((await action.builder.orchestrator.getEditedData()).id).toBe(
            before.id,
          );
          return viewer;
        };
        const ent = await action.saveX();
        expect((await action.builder.orchestrator.getEditedData()).id).toBe(
          before.id,
        );
        expect(ent.id).toBe(before.id);
        expect(ent.data.balance).toBe(42);
        expect(calls).toBe(1);
        return { action, id: ent.id };
      });
      expect(
        (await action.action.builder.orchestrator.getEditedData()).id,
      ).toBe(action.id);
      expect(calls).toBe(1);
    },
  );
  test.each(sources)(
    "pending %s preparation cannot finish after another guarded save",
    async (source) => {
      const started = deferred();
      const release = deferred();
      await expect(
        withTransaction(async () => {
          const action = make(source, async () => {
            const n =
              (
                await loadRows({
                  ...options,
                  clause: Eq("admin", true),
                  context,
                })
              ).length + 1;
            started.resolve();
            await release.promise;
            return n;
          });
          const pending = action.builder.orchestrator.getEditedData();
          const checked = expect(pending).rejects.toThrow(
            "cannot cross transaction generations",
          );
          await started.promise;
          try {
            await make(source, () => 1).saveX();
          } finally {
            release.resolve();
          }
          await checked;
        }),
      ).rejects.toThrow("cannot cross transaction generations");
      expect((await rows()).rows).toEqual([]);
    },
  );
});
