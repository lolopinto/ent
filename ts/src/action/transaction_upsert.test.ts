import { randomUUID } from "crypto";
import { Allow, Deny, ID } from "../core/base";
import { Dialect } from "../core/db";
import { loadEnt, loadEntX } from "../core/ent";
import { ObjectLoaderFactory } from "../core/loaders";
import { withTransactionScope } from "../core/transaction";
import { BooleanType, IntegerType, StringType } from "../schema";
import {
  BaseEnt,
  SimpleAction,
  getBuilderSchemaFromFields,
  getDbFields,
} from "../testutils/builder";
import { TestContext } from "../testutils/context/test_context";
import { getSchemaTable, setupPostgres } from "../testutils/db/temp_db";
import { WriteOperation } from "./action";
import { EntChangeset } from "./orchestrator";

let requiredBalance: number | undefined;
class UpsertAccount extends BaseEnt {
  nodeType = "UpsertAccount";
  getPrivacyPolicy() {
    return {
      rules: [
        {
          apply: async () =>
            requiredBalance === undefined ||
            this.data.balance === requiredBalance
              ? Allow()
              : Deny(),
        },
      ],
    };
  }
}
const schema = getBuilderSchemaFromFields(
  {
    balance: IntegerType(),
    admin: BooleanType(),
    accountKey: StringType({ unique: true }),
  },
  UpsertAccount,
);
const loader = {
  tableName: "upsert_accounts",
  fields: getDbFields(schema),
  key: "id",
};
const options = {
  ...loader,
  ent: UpsertAccount,
  loaderFactory: new ObjectLoaderFactory(loader),
};
const context = new TestContext();
const viewer = context.getViewer();
const load = (id: ID) => loadEntX(viewer, id, options);
class Guarded extends SimpleAction<UpsertAccount> {
  requiresTransactionScope() {
    return true;
  }
}
const create = () =>
  new SimpleAction(
    viewer,
    schema,
    new Map<string, unknown>([
      ["balance", 100],
      ["admin", false],
      ["accountKey", randomUUID()],
    ]),
    WriteOperation.Insert,
    null,
  ).saveX();
const edit = (ent: UpsertAccount, balance: number) =>
  new Guarded(
    viewer,
    schema,
    new Map([["balance", balance]]),
    WriteOperation.Edit,
    ent,
  );
function conflict(
  owner: UpsertAccount,
  key: "id" | "account_key",
  update = false,
) {
  const attemptedID = key === "id" ? owner.id : randomUUID();
  const action = new Guarded(
    viewer,
    schema,
    new Map<string, unknown>([
      ["id", attemptedID],
      ["accountKey", owner.data.account_key],
      ["balance", 100],
      ["admin", true],
    ]),
    WriteOperation.Insert,
    null,
  );
  action.builder.orchestrator.setOnConflictOptions({
    onConflictCols: [key],
    updateCols: update ? ["admin"] : undefined,
  });
  return { action, attemptedID };
}
setupPostgres(() => [getSchemaTable(schema, Dialect.Postgres)]);
beforeEach(() => {
  context.cache.reset();
  requiredBalance = undefined;
});
afterEach(() => {
  requiredBalance = undefined;
});

describe.each([
  ["root", false],
  ["child", false],
  ["root", true],
  ["child", true],
] as const)("upsert %s result with update %s", (position, update) => {
  test.each([
    ["id", false],
    ["id", true],
    ["account_key", false],
    ["account_key", true],
  ] as const)("conflict on %s with result privacy %s sees final graph writes", async (key, privacy) => {
    const owner = await create();
    await withTransactionScope(async () => {
      const current = await load(owner.id);
      const { action: upsert, attemptedID } = conflict(current, key, update);
      const writer = edit(current, 80);
      const parent = position === "root" ? upsert : writer;
      const child = position === "root" ? writer : upsert;
      parent.getTriggers = () => [{ changeset: () => child.changeset() }];
      requiredBalance = privacy ? 80 : undefined;
      await parent.saveX();
      const result = await upsert.editedEntX();
      expect(result.id).toBe(owner.id);
      if (key === "account_key") {
        expect(result.id).not.toBe(attemptedID);
      }
      expect(result.data.balance).toBe(80);
      expect(result.data.admin).toBe(update);
      requiredBalance = undefined;
      await edit(result, result.data.balance - 30).saveX();
    });
    expect((await load(owner.id)).data.balance).toBe(50);
  });
});

test.each([
  false,
  true,
])("conflict result deleted later in the graph, strict getter %s", async (strict) => {
  const owner = await create();
  let resultFailure: unknown;
  const transaction = withTransactionScope(async () => {
    const current = await load(owner.id);
    const { action: upsert } = conflict(current, "account_key");
    const parent = new SimpleAction(
      viewer,
      schema,
      new Map(),
      WriteOperation.Delete,
      current,
    );
    parent.getTriggers = () => [{ changeset: () => upsert.changeset() }];
    await parent.save();
    expect(await loadEnt(viewer, owner.id, options)).toBeNull();
    if (strict) {
      await upsert.editedEntX().catch((error) => {
        resultFailure = error;
      });
      expect(resultFailure).toBeInstanceOf(Error);
    } else {
      expect(await upsert.editedEnt()).toBeNull();
    }
  });
  if (strict) {
    const transactionFailure = await transaction.catch((error) => error);
    expect(resultFailure).toBeInstanceOf(Error);
    expect(transactionFailure).toBe(resultFailure);
    expect((await load(owner.id)).data.balance).toBe(100);
  } else {
    await transaction;
    expect(await loadEnt(viewer, owner.id, options)).toBeNull();
  }
});

test.each([
  false,
  true,
])("new row result includes later graph writes, upsert %s", async (upsert) => {
  const id = randomUUID();
  await withTransactionScope(async () => {
    const action = new Guarded(
      viewer,
      schema,
      new Map<string, unknown>([
        ["id", id],
        ["accountKey", randomUUID()],
        ["balance", 100],
        ["admin", false],
      ]),
      WriteOperation.Insert,
      null,
    );
    if (upsert) {
      action.builder.orchestrator.setOnConflictOptions({
        onConflictCols: ["account_key"],
      });
    }
    action.getTriggers = () => [
      {
        changeset: async () =>
          EntChangeset.changesetFromQueries(action.builder, [
            {
              query: "UPDATE upsert_accounts SET balance = $1 WHERE id = $2",
              values: [80, id],
            },
          ]),
      },
    ];
    const result = await action.saveX();
    expect(result.id).toBe(id);
    expect(result.data.balance).toBe(80);
    await edit(result, result.data.balance - 30).saveX();
  });
  expect((await load(id)).data.balance).toBe(50);
});

test.each([
  false,
  true,
])("ordinary child result reflects a later raw sibling write, privacy %s", async (privacy) => {
  const parentOwner = await create();
  const childOwner = await create();
  await withTransactionScope(async () => {
    const parent = edit(await load(parentOwner.id), 80);
    const child = new Guarded(
      viewer,
      schema,
      new Map([["admin", true]]),
      WriteOperation.Edit,
      await load(childOwner.id),
    );
    parent.getTriggers = () => [
      {
        changeset: async () => [
          await child.changeset(),
          EntChangeset.changesetFromQueries(parent.builder, [
            {
              query: "UPDATE upsert_accounts SET balance = $1 WHERE id = $2",
              values: [80, childOwner.id],
            },
          ]),
        ],
      },
    ];
    requiredBalance = privacy ? 80 : undefined;
    await parent.saveX();
    const result = await child.editedEntX();
    expect(result.data.balance).toBe(80);
    expect(result.data.admin).toBe(true);
    requiredBalance = undefined;
    await edit(result, result.data.balance - 30).saveX();
  });
  expect((await load(childOwner.id)).data.balance).toBe(50);
});
