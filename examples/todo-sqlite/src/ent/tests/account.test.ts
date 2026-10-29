import { EditAccountAction } from "../account/actions/edit_account_action";
import { DeleteAccountAction } from "../account/actions/delete_account_action";
import { Account } from "../internal";
import { createAccount } from "../testutils/util";
import { advanceTo } from "jest-date-mock";
import { AccountUpdateBalanceAction } from "../account/actions/account_update_balance_action";
import { AccountTransferCreditsAction } from "../account/actions/account_transfer_credits_action";
import { Transaction } from "@snowtop/ent/action";
import { LoggedOutViewer, Viewer } from "@snowtop/ent";
import { SystemViewer } from "src/privacy/policies";

test("create", async () => {
  await createAccount();
});

test("create with prefs", async () => {
  const account = await createAccount({
    accountPrefs: {
      finishedNux: false,
      enableNotifs: true,
      preferredLanguage: "fr_FR",
    },
  });
  expect(account.accountPrefs).toStrictEqual({
    finishedNux: false,
    enableNotifs: true,
    preferredLanguage: "fr_FR",
  });
});

test("field privacy", async () => {
  // viewer can see their own phone number and account state. no one else can
  const account1 = await createAccount();
  expect(account1.phoneNumber).not.toBeNull();
  expect(account1.accountState).not.toBeNull();

  const account2 = await createAccount();
  expect(account2.phoneNumber).not.toBeNull();
  expect(account2.accountState).not.toBeNull();

  const fromOther = await Account.loadX(account1.viewer, account2.id);
  expect(fromOther.phoneNumber).toBeNull();
  expect(fromOther.accountState).toBeNull();
});

test("edit", async () => {
  let account = await createAccount();
  account = await EditAccountAction.create(account.viewer, account, {
    name: "Aegon Targaryen",
  }).saveX();
  expect(account.name).toBe("Aegon Targaryen");
});

test("delete", async () => {
  let account = await createAccount();
  expect(account.getDeletedAt()).toBeNull();

  const d = new Date();
  advanceTo(d);

  await DeleteAccountAction.create(account.viewer, account).saveX();
  let reloaded = await Account.load(account.viewer, account.id);
  expect(reloaded).toBeNull();

  const transformed = await Account.loadSoftDeleted(account.viewer, account.id);
  expect(transformed).not.toBeNull();
  expect(transformed?.getDeletedAt()).toEqual(d);

  // then really delete
  await DeleteAccountAction.create(account.viewer, account).hardDeleteX();
  const transformed2 = await Account.loadSoftDeleted(
    account.viewer,
    account.id,
  );
  expect(transformed2).toBeNull();
});

test("really delete", async () => {
  let account = await createAccount();
  expect(account.getDeletedAt()).toBeNull();

  const d = new Date();
  advanceTo(d);

  await DeleteAccountAction.create(account.viewer, account).hardDeleteX();
  let reloaded = await Account.load(account.viewer, account.id);
  expect(reloaded).toBeNull();

  const transformed = await Account.loadSoftDeleted(account.viewer, account.id);
  expect(transformed).toBeNull();
});

test("update balance", async () => {
  // balances only change on behalf of an authorized transfer
  const account = await createAccount();
  expect(account.credits).toBe(1000);
  const system = new SystemViewer();
  await AccountUpdateBalanceAction.create(system, account, {
    credits: {
      add: 100,
    },
  }).saveX();
  await expectCredits(account, 1100);

  await AccountUpdateBalanceAction.create(
    system,
    await Account.loadX(account.viewer, account.id),
    {
      credits: {
        subtract: 330,
      },
    },
  ).saveX();
  await expectCredits(account, 770);

  try {
    await AccountUpdateBalanceAction.create(
      system,
      await Account.loadX(account.viewer, account.id),
      {
        credits: {
          subtract: 1000,
        },
      },
    ).saveX();
    throw new Error(`should have thrown`);
  } catch (err) {
    expect((err as Error).message).toBe("cannot have negative credits balance");
  }

  await expectCredits(account, 770);
});

test("transfer balance", async () => {
  let account1 = await createAccount();
  let account2 = await createAccount();

  await AccountTransferCreditsAction.create(account1.viewer, account1, {
    to: account2.id,
    amount: 50,
  }).saveX();

  account1 = await Account.loadX(account1.viewer, account1.id);
  account2 = await Account.loadX(account2.viewer, account2.id);

  expect(account1.credits).toBe(950);
  expect(account2.credits).toBe(1050);
});

test("transfer balance in transaction", async () => {
  let account1 = await createAccount();
  let account2 = await createAccount();
  let account3 = await createAccount();

  const tx = new Transaction(account1.viewer, [
    AccountTransferCreditsAction.create(account1.viewer, account1, {
      to: account2.id,
      amount: 50,
    }),
    AccountTransferCreditsAction.create(account1.viewer, account1, {
      to: account3.id,
      amount: 50,
    }),
  ]);
  await tx.run();

  account1 = await Account.loadX(account1.viewer, account1.id);
  account2 = await Account.loadX(account2.viewer, account2.id);
  account3 = await Account.loadX(account3.viewer, account3.id);

  expect(account1.credits).toBe(900);
  expect(account2.credits).toBe(1050);
  expect(account3.credits).toBe(1050);
});

test("transfer balance in transaction overall overage", async () => {
  let account1 = await createAccount();
  let account2 = await createAccount();
  let account3 = await createAccount();

  // this is a known and acceptable? issue because we don't currently support
  // validators across multiple things in a transaction
  // ways to fix:
  // check constraint at the db level
  // wrapper actions which takes input for all child actions and does the validation there

  const tx = new Transaction(account1.viewer, [
    AccountTransferCreditsAction.create(account1.viewer, account1, {
      to: account2.id,
      amount: 1000,
    }),
    AccountTransferCreditsAction.create(account1.viewer, account1, {
      to: account3.id,
      amount: 1000,
    }),
  ]);
  await tx.run();

  account1 = await Account.loadX(account1.viewer, account1.id);
  account2 = await Account.loadX(account2.viewer, account2.id);
  account3 = await Account.loadX(account3.viewer, account3.id);

  expect(account1.credits).toBe(-1000);
  expect(account2.credits).toBe(2000);
  expect(account3.credits).toBe(2000);
});

test("transfer balance in transaction 1 overage", async () => {
  let account1 = await createAccount();
  let account2 = await createAccount();
  let account3 = await createAccount();

  try {
    const tx = new Transaction(account1.viewer, [
      AccountTransferCreditsAction.create(account1.viewer, account1, {
        to: account2.id,
        amount: 100,
      }),
      AccountTransferCreditsAction.create(account1.viewer, account1, {
        to: account3.id,
        amount: 11000,
      }),
    ]);
    await tx.run();
    throw new Error(`should have thrown`);
  } catch (err) {
    expect((err as Error).message).toBe("cannot have negative credits balance");
  }

  account1 = await Account.loadX(account1.viewer, account1.id);
  account2 = await Account.loadX(account2.viewer, account2.id);
  account3 = await Account.loadX(account3.viewer, account3.id);

  expect(account1.credits).toBe(1000);
  expect(account2.credits).toBe(1000);
  expect(account3.credits).toBe(1000);
});

async function expectCredits(account: Account, credits: number) {
  const reloaded = await Account.loadX(account.viewer, account.id);
  expect(reloaded.credits).toBe(credits);
}

test("no viewer can set a balance directly", async () => {
  const account = await createAccount();
  const other = await createAccount();
  for (const viewer of [account.viewer, other.viewer, new LoggedOutViewer()]) {
    const action = AccountUpdateBalanceAction.create(viewer, account, {
      credits: { add: 100 },
    });
    expect(await action.valid()).toBe(false);
    await expect(action.saveX()).rejects.toThrow(
      /does not have permission to edit/,
    );
  }
  await expectCredits(account, 1000);
});

test("only the source account can transfer credits", async () => {
  const account1 = await createAccount();
  const account2 = await createAccount();
  const viewers: Viewer[] = [account2.viewer, new LoggedOutViewer()];
  for (const viewer of viewers) {
    // e.g. account2 pulling credits from account1 to itself
    const action = AccountTransferCreditsAction.create(viewer, account1, {
      to: account2.id,
      amount: 50,
    });
    expect(await action.valid()).toBe(false);
    await expect(action.saveX()).rejects.toThrow(
      /does not have permission to edit/,
    );
  }
  await expectCredits(account1, 1000);
  await expectCredits(account2, 1000);
});

test("transfer amount must be positive", async () => {
  const account1 = await createAccount();
  const account2 = await createAccount();
  for (const amount of [0, -50]) {
    // a negative transfer would pull credits from the recipient
    await expect(
      AccountTransferCreditsAction.create(account1.viewer, account1, {
        to: account2.id,
        amount,
      }).saveX(),
    ).rejects.toThrow("transfer amount must be a positive integer");
  }
  await expectCredits(account1, 1000);
  await expectCredits(account2, 1000);
});

test("only the account can edit or delete itself", async () => {
  const account = await createAccount();
  const other = await createAccount();
  for (const viewer of [other.viewer, new LoggedOutViewer()]) {
    expect(
      await EditAccountAction.create(viewer, account, {
        name: "Aegon Targaryen",
      }).valid(),
    ).toBe(false);
    expect(await DeleteAccountAction.create(viewer, account).valid()).toBe(
      false,
    );
  }
  const reloaded = await Account.loadX(account.viewer, account.id);
  expect(reloaded.name).toBe(account.name);
  expect(reloaded.getDeletedAt()).toBeNull();
});
