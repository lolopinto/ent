import { Allow, Data, ID, Viewer } from "./base";
import DB, { Dialect } from "./db";
import { Eq } from "./clause";
import {
  applyPrivacyPolicyForRow,
  applyPrivacyPolicyForRows,
  loadDerivedEnt,
  loadDerivedEntX,
  loadEntX,
  loadRows,
} from "./ent";
import { ObjectLoaderFactory } from "./loaders";
import { withTransactionScope } from "./transaction";
import {
  assertEntTransaction,
  getTransactionState,
} from "./transaction_context";
import { WriteOperation } from "../action/action";
import { IntegerType } from "../schema";
import {
  BaseEnt,
  SimpleAction,
  getBuilderSchemaFromFields,
  getDbFields,
} from "../testutils/builder";
import { setupPostgres, getSchemaTable } from "../testutils/db/temp_db";
import { TestContext } from "../testutils/context/test_context";

class DerivedAccount extends BaseEnt {
  nodeType = "DerivedAccount";
}
const schema = getBuilderSchemaFromFields(
  { balance: IntegerType() },
  DerivedAccount,
);
const loader = {
  tableName: "derived_accounts",
  fields: getDbFields(schema),
  key: "id",
};
const options = {
  ...loader,
  ent: DerivedAccount,
  loaderFactory: new ObjectLoaderFactory(loader),
};
const context = new TestContext();
const viewer = context.getViewer();
const load = (id: ID) => loadEntX(viewer, id, options);
const create = () =>
  new SimpleAction(
    viewer,
    schema,
    new Map([["balance", 100]]),
    WriteOperation.Insert,
    null,
  ).saveX();
class GuardedEdit extends SimpleAction<DerivedAccount> {
  requiresTransactionScope() {
    return true;
  }
}
const edit = (ent: DerivedAccount, balance: number) =>
  new GuardedEdit(
    viewer,
    schema,
    new Map([["balance", balance]]),
    WriteOperation.Edit,
    ent,
  );
let privacy: ((ent: DerivedAccount) => void | Promise<void>) | undefined;
class PrivacyAccount extends DerivedAccount {
  getPrivacyPolicy() {
    return {
      rules: [
        {
          async apply(_viewer: Viewer, ent: DerivedAccount) {
            await privacy?.(ent);
            return Allow();
          },
        },
      ],
    };
  }
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
setupPostgres(() => [getSchemaTable(schema, Dialect.Postgres)]);
beforeEach(() => {
  context.cache.reset();
  privacy = undefined;
});

describe.each([
  "loadDerivedEnt",
  "loadDerivedEntX",
  "applyPrivacyPolicyForRow",
  "applyPrivacyPolicyForRows",
] as const)("%s transaction provenance", (method) => {
  const derive = async (row: Data, ctor = DerivedAccount) => {
    switch (method) {
      case "loadDerivedEnt":
        return loadDerivedEnt(viewer, row, ctor);
      case "loadDerivedEntX":
        return loadDerivedEntX(viewer, row, ctor);
      case "applyPrivacyPolicyForRow":
        return applyPrivacyPolicyForRow(viewer, { ...options, ent: ctor }, row);
      case "applyPrivacyPolicyForRows":
        return (
          await applyPrivacyPolicyForRows(viewer, [row], {
            ...options,
            ent: ctor,
          })
        )[0];
    }
  };

  test.each([
    "query",
    "queryAll",
    "exec",
  ] as const)("%s rows retain their provenance before privacy and support scoped saves", async (queryMethod) => {
    const account = await create();
    let checks = 0;
    await withTransactionScope(async (tx) => {
      const row = (
        await tx[queryMethod]("SELECT * FROM derived_accounts WHERE id = $1", [
          account.id,
        ])
      ).rows[0];
      privacy = (ent) => {
        assertEntTransaction(ent);
        checks++;
      };
      const derived = await derive(row, PrivacyAccount);
      await edit(derived!, 80).saveX();
    });
    expect(checks).toBe(1);
    expect((await load(account.id)).data.balance).toBe(80);
  });

  test.each([
    "stale generation",
    "previous scope",
    "outside row",
    "untracked driver row",
    "unknown outside row",
    "unknown current row",
  ])("%s cannot become a fresh mutation input", async (origin) => {
    const account = await create();
    let row: Data;
    if (origin === "previous scope") {
      row = await withTransactionScope(async (tx) => {
        return (
          await tx.query("SELECT * FROM derived_accounts WHERE id = $1", [
            account.id,
          ])
        ).rows[0];
      });
    } else if (origin === "outside row") {
      row = (
        await loadRows({ ...loader, clause: Eq("id", account.id), context })
      )[0];
    } else if (origin === "untracked driver row") {
      row = (
        await DB.getInstance()
          .getPool()
          .query("SELECT * FROM derived_accounts WHERE id = $1", [account.id])
      ).rows[0];
    } else if (origin === "unknown outside row") {
      row = { ...account.data };
    }
    let caught: unknown;
    let outer: unknown;
    try {
      await withTransactionScope(async (tx) => {
        if (origin === "stale generation" || origin === "unknown current row") {
          row = (
            await tx.query("SELECT * FROM derived_accounts WHERE id = $1", [
              account.id,
            ])
          ).rows[0];
          if (origin === "unknown current row") {
            row = { ...row };
          } else {
            await edit(await load(account.id), 90).saveX();
          }
        }
        const derived = await derive(row!);
        expect(derived!.data.balance).toBe(100);
        try {
          await edit(derived!, 80).saveX();
        } catch (error) {
          caught = error;
        }
      });
    } catch (error) {
      outer = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(outer).toBe(caught);
    expect((await load(account.id)).data.balance).toBe(100);
  });

  test("copied old data cannot overwrite a later committed balance", async () => {
    const account = await create();
    const copied = { ...account.data };
    await withTransactionScope(async () => {
      await edit(await load(account.id), 80).saveX();
    });
    await expect(
      withTransactionScope(async () => {
        const stale = await derive(copied);
        await edit(stale!, stale!.data.balance - 30).saveX();
      }),
    ).rejects.toThrow("reload existingEnt");
    expect((await load(account.id)).data.balance).toBe(80);
    await withTransactionScope(async (tx) => {
      const row = (
        await tx.query("SELECT * FROM derived_accounts WHERE id = $1", [
          account.id,
        ])
      ).rows[0];
      const fresh = await derive(row);
      await edit(fresh!, fresh!.data.balance - 30).saveX();
    });
    expect((await load(account.id)).data.balance).toBe(50);
  });

  test("unknown data still supports derived reads outside a transaction", async () => {
    const account = await create();
    const derived = await derive({ ...account.data });
    expect(derived!.id).toBe(account.id);
    expect(derived!.data.balance).toBe(100);
  });

  test("pending derived privacy cannot cross a scoped save", async () => {
    const account = await create();
    const started = deferred();
    const release = deferred();
    await expect(
      withTransactionScope(async (tx) => {
        const row = (
          await tx.query("SELECT * FROM derived_accounts WHERE id = $1", [
            account.id,
          ])
        ).rows[0];
        const current = await loadDerivedEntX(viewer, row, DerivedAccount);
        privacy = async () => {
          started.resolve();
          await release.promise;
        };
        const outcome = derive(row, PrivacyAccount).then(
          (value) => ({ value }),
          (error) => ({ error }),
        );
        await started.promise;
        try {
          await edit(current, 80).saveX();
        } finally {
          release.resolve();
        }
        const result = await outcome;
        expect(result).toHaveProperty("error");
      }),
    ).rejects.toThrow("cannot cross transaction generations");
    expect((await load(account.id)).data.balance).toBe(100);
  });

  test.each([
    "valid",
    "validX",
    "validWithErrors",
  ] as const)("%s waits for derived privacy used to prepare a child", async (validationMethod) => {
    const accounts = await Promise.all([create(), create(), create()]);
    const started = deferred();
    const release = deferred();
    const failure = new Error("correctable validation failure");
    let invalid = true;
    let settled = false;
    let settledBeforeRelease = false;
    let prepared = 0;
    const transaction = withTransactionScope(async (tx) => {
      const parent = edit(await load(accounts[0].id), 90);
      const bad = edit(await load(accounts[1].id), 80);
      bad.getValidators = () => [
        { validate: async () => (invalid ? failure : undefined) },
      ];
      const row = (
        await tx.query("SELECT * FROM derived_accounts WHERE id = $1", [
          accounts[2].id,
        ])
      ).rows[0];
      privacy = async () => {
        started.resolve();
        await release.promise;
      };
      let setupOutcome!: Promise<any>;
      parent.getTriggers = () => [
        {
          changeset: () => {
            const setup = (async () => {
              const derived = await derive(row, PrivacyAccount);
              const changeset = await edit(derived!, 70).changeset();
              prepared++;
              return changeset;
            })();
            setupOutcome = setup.then(
              (value) => ({ value }),
              (error) => ({ error }),
            );
            return Promise.all([bad.changeset(), setup]);
          },
        },
      ];
      const validation = parent[validationMethod]().then(
        () => {
          settled = true;
          return undefined;
        },
        (error) => {
          settled = true;
          return error;
        },
      );
      expect(await validation).toBe(failure);
      expect(await setupOutcome).toHaveProperty("value");
      expect(settledBeforeRelease).toBe(false);
      expect(getTransactionState()!.failed).toBe(false);
      invalid = false;
      await parent.saveX();
    });
    const outcome = transaction.then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    try {
      await started.promise;
      await new Promise<void>((resolve) => setImmediate(resolve));
      settledBeforeRelease = settled;
      release.resolve();
      expect(await outcome).not.toHaveProperty("error");
      expect(prepared).toBe(2);
      const balances = await Promise.all(
        accounts.map(async (account) => (await load(account.id)).data.balance),
      );
      expect(balances).toEqual([90, 80, 70]);
    } finally {
      release.resolve();
      await outcome;
    }
  });
});
