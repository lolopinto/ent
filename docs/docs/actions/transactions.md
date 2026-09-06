---
sidebar_position: 16
---

# Transactions

Use `Transaction` when you need multiple actions' writes to succeed or fail together. By default, action preparation, validators, and [triggers](/docs/actions/triggers) run before the write transaction. The changesets that triggers return share that transaction's writes. To include reads and action preparation, use `withTransaction` on PostgreSQL.

## Transaction-scoped reads and actions

`withTransaction` starts a transaction before calling its callback. Ent reads, privacy checks, validators, triggers, actions, edge writes, and audit changesets inside the callback use the same reserved connection. Other asynchronous requests use their own connections and caches. Outside this API, existing actions and `Transaction.run()` keep their default behavior.

```ts
import { withTransaction } from "@snowtop/ent";

const result = await withTransaction(async () => {
  // Reload and reconstruct on every attempt, including the first.
  const account = await Account.loadX(viewer, accountID);
  return EditAccountAction.create(viewer, account, {
    balance: account.balance - amount,
  }).saveX();
}, { maxRetries: 3 });
```

The default isolation level is `serializable`. PostgreSQL rejects conflicting transactions with SQLSTATE `40001` and reports deadlocks with `40P01`. `maxRetries` defaults to zero. If you set `maxRetries` above zero, these errors cause the whole callback to retry with a new connection reservation, snapshot, loaders, and actions.

Every operation that enforces the invariant must follow a compatible serializable or locking protocol. This API doesn't automatically protect unrelated writers that use read committed isolation. For details, see [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html).

If you enable retries, keep external side effects out of the callback and triggers. Send notifications through observers, or use an action to write an outbox record in the same transaction. Rollback doesn't undo sequence values or changes to external systems. If a connection fails during `COMMIT` and leaves the outcome unknown, `withTransaction` doesn't retry. Reconcile the outcome before retrying externally.

### Require transactions for an action

An action that enforces an invariant can require a transaction scope on every normal action save, builder save, or changeset entry point:

```ts
export default class RemoveAdminAction extends RemoveAdminActionBase {
  requiresTransaction() {
    return "serializable" as const;
  }
}

await withTransaction(
  () => RemoveAdminAction.saveXFromID(viewer, fundID, { adminID }),
  { maxRetries: 3 },
);
```

Return `true` from `requiresTransaction()` to require either supported isolation level, or return `"serializable"` to reject weaker isolation. This guard runs before privacy checks, triggers, and validators. Apply it to every action that can violate the invariant, including generated GraphQL mutations and alternative edit or delete paths. Your application must protect raw SQL and custom actions that bypass the Ent orchestrator.

Construct actions, builders, queries, and loaders inside the callback. Load `existingEnt` there too, and construct triggered changesets during that attempt. The runtime rejects builders, changesets, standard cached loaders, and preloaded Ents that don't belong to the current scope. Don't reuse a changeset or builder on another attempt.

A GraphQL mutation wrapper must throw execution errors out of the callback. Returning an error-shaped result still counts as a successful return and requests a commit. An action save, executor assembly, or SQL failure marks the scope as failed even if you catch the error, so earlier writes roll back. Regenerated `saveXFromID` and `saveFromID` helpers include their initial load, construction, and edge setup in this failure boundary. A missing target returned by a nullable helper remains recoverable.

#### Prepare guarded root actions sequentially

Prepare and save guarded root actions sequentially. Don't prebuild two guarded roots with `changeset()`, combine them in `Transaction`, or call their saves in `Promise.all`. These operations reject and roll back the scope even if the actions might be independent.

After each guarded save, reconstruct queries and loaders and reload the Ents needed for the next action. Also reconstruct actions whose defaults or transforms were already prepared by validation or a getter. Each guarded save advances the transaction's generation, so prepared values can't carry over to the next save. Prebuilt changesets and assembled executors, including those for ordinary unguarded actions, also expire after a guarded save. They reject before fetching or writing data.

These checks prevent two root validators or rollups from preparing against the same old state within one transaction, where database isolation can't detect the dependency.

#### Compose guarded actions

Return child changesets from triggers. Don't call a child's `save()` or `saveX()` method or execute child executors during preparation. Distinct guarded actions conflict by default. This includes ancestors, descendants, and actions separated by an unguarded wrapper. For example, a parent and child that remove different admin rows can both read the old count and violate the last-admin invariant. Their parent-child relationship doesn't establish independence.

If you have established that the actions are independent, implement `getTransactionResources()` on every participating guarded action, including the parent. Return the keys for the invariants that each action depends on:

```ts
getTransactionResources(): readonly string[] {
  // Use this key only if the action's decisions depend on this account alone.
  return [`account:${this.builder.existingEnt.id}`];
}
```

Use non-empty arrays of non-empty strings to declare explicit resources. The runtime takes a snapshot of these arrays. Only actions with disjoint resource keys can prepare together; ancestors and descendants must also have disjoint keys. Guarded roots must still run sequentially, even with explicit keys.

If you omit the hook or return `undefined`, the action reserves a wildcard resource. This reservation conflicts with every other guarded action in the prepared graph, including actions with explicit keys. There is no special wildcard string. Defining the hook requires `withTransaction`, even without `requiresTransaction()`.

Declare every dependency that another action could invalidate, including aggregate predicates and privacy checks, rather than only the row being written. For example, a parent that changes account A's balance and a child that changes account B's balance can declare separate account keys if neither decision depends on the other account. Two actions that depend on the same admin count must share an invariant key and will be rejected. Consolidate their decisions into one action, or save sequentially and reload. Existing parent-child compositions that relied on ancestry alone must adopt this contract.

During execution, the runtime also rejects known repeated updates or deletes of the same row through different builders in a guarded tree. Skipped conditional operations and changes limited to edges don't count as row mutations. Consolidate overlapping absolute updates into one child action. The runtime doesn't infer invariant keys from SQL dependencies; your application must declare all shared dependencies. Existing unguarded action batches keep their behavior.

#### Validate without saving

Standalone `valid()`, `validX()`, and `validWithErrors()` calls inside a scope use the same preparation guards. Their child changesets and resource reservations are temporary. After validation, the runtime discards them, including when validation reports errors. A subsequent save reruns validation and prepares a fresh child graph. Changesets captured during standalone validation can't execute. Cleanup also applies to retained children and grandchildren.

Before closing the validation scope, the runtime waits for participating SQL, Ent, privacy, and loader reads used to set up children. It waits even if another child has already failed and preserves the original validation error. A later SQL or composition failure still aborts the transaction.

Field defaults and action or schema transformation results remain memoized. This preserves established builder IDs and applies transformed input only once. A transformation's `changeset` factory runs during each validation or save preparation in a scope and must build a fresh child changeset. Computing fields through a getter alone doesn't run the factory.

Cleanup retains edges established by default-field `updateInput` and discards edges to children created during standalone validation. Validation can still change action fields through existing trigger behavior; it doesn't roll back application state in general. Await validation before building or saving the same action. You can inspect and correct normal validation errors. SQL failures and invalid transaction composition still fail the transaction.

### Explicit locks and composition

If you use read committed isolation, lock the invariant's stable owner row before reading data used for decisions. Every competing writer must acquire the same lock. Locking only rows about to be deleted can't protect an empty set or a last-admin count. Acquire multiple locks in a consistent order.

```ts
await withTransaction(async (tx) => {
  await tx.query("SELECT id FROM accounts WHERE id = $1 FOR UPDATE", [accountID]);
  const account = await Account.loadX(viewer, accountID);
  await EditAccountAction.create(viewer, account, {
    balance: account.balance - amount,
  }).saveX();
}, { isolationLevel: "read committed" });
```

The callback receives `query`, `queryAll`, `exec`, `attempt` (zero-based), and `isolationLevel`. Use PostgreSQL placeholders to parameterize SQL. Low-level SQL doesn't apply Ent privacy or create audit actions. Use it for locks, then use Ent actions for mutations. Don't send SQL that controls the transaction, use DB handles captured before the callback, or change global DB configuration while a scope is active.

`withTransaction` rejects nested calls; it doesn't support savepoints or independent inner commits. Composed services can inspect `getTransactionScope()` (exported from `@snowtop/ent`), check its `isolationLevel`, and call their implementation directly if an appropriate scope already exists. `new Transaction(viewer, actions).run()` joins the current scope.

### Caches, results, and observers

#### Queries and caches

Cached queries and loaders belong to the guarded-action generation in which you create them. Reusing them after a guarded save, or letting a pending read span that save, rejects and marks the scope as failed even if you catch the error. Await reads before saving, then create fresh readers for the next action. Reuse within the same generation and ordinary behavior outside a scope are unchanged.

Converting previously read rows to Ents preserves their original transaction and generation, including rows returned by `tx.query`, `tx.queryAll`, and `tx.exec`. Supplied Ents and `sourceEnt()` results used by edge-query privacy must belong to the current generation.

Standard Ent, object, count, query, and edge-metadata caches are isolated for each attempt. Transaction rows never populate request caches outside the scope. Commit invalidates participating request caches; rollback leaves them unchanged. SQL calls conservatively invalidate the attempt's caches, so raw writes and reads after acquiring locks see fresh data.

#### Results

`saveX()` results inside the callback are provisional. A thrown result-loading or post-fetch error marks the owning scope as failed, so all writes roll back even if you catch the error. This includes direct `editedEntX()` failures and exceptions from `viewerForEntLoad` or result privacy checks. Normal `null` results from nullable `save()` and `editedEnt()` calls don't fail the scope.

Direct result-loading errors from getters used after their owning commit can't undo that commit or fail a different transaction. Queries and actions that application privacy callbacks explicitly execute inside a later scope still follow that active scope's failure rules.

Don't expose callback results until `withTransaction` resolves. After commit, returned Ent objects remain snapshots. Reload them inside a new scope to edit them again.

Calling `editedEnt()` or `editedEntX()` again reads the action's retained result row and preserves that write's transaction and generation. Inspecting an old snapshot inside a later scope or after another guarded root saves doesn't make it a fresh mutation input. Immediate results of the latest completed action graph remain usable in that generation. After later guarded writes, reload from the database.

#### Observers and asynchronous work

Action observers wait until the owning transaction commits. They then run outside its scope, after the connection is released. Rollback and failed retry attempts discard observers. Observer errors keep the existing best-effort policy and never cause committed work to retry. Observers can't roll back a commit and don't guarantee durable, exactly-once delivery.

Await all work inside the callback. SQL still in progress when the callback returns causes rollback, and asynchronous work that inherits the scope can't use it after it closes. Detached jobs must start with their own request context.

### Supported runtimes

`withTransaction` supports PostgreSQL with Node's `pg` driver and Bun's `pg` or native Bun SQL driver. It rejects SQLite because the existing shared synchronous connection can't safely hold an asynchronous transaction scope across concurrent requests. It also rejects `repeatable read` and other isolation modes. Existing SQLite action transactions continue to work normally.

## Basic usage

This example creates two contacts for the same user in a single transaction.

```ts
import { Viewer } from "@snowtop/ent";
import { Transaction } from "@snowtop/ent/action";

const viewer: Viewer = context.viewer;
const userId = viewer.viewerID!;
const action1 = CreateContactAction.create(viewer, {
  firstName: "Jon",
  lastName: "Snow",
  userId,
});
const action2 = CreateContactAction.create(viewer, {
  firstName: "Jon",
  lastName: "Snow",
  userId,
});

const tx = new Transaction(viewer, [action1, action2]);
await tx.run();
```

## Dependencies between actions

You can reference one action's builder in another action's input to express dependencies. The executor will resolve those dependencies inside the transaction.

```ts
import { Viewer } from "@snowtop/ent";
import { Transaction } from "@snowtop/ent/action";

const viewer: Viewer = context.viewer;
const userAction = CreateUserAction.create(viewer, {
  firstName: "Arya",
  lastName: "Stark",
  emailAddress: "arya@example.com",
  phoneNumber: "555-0101",
  password: "pa$$w0rd",
});

const contactAction = CreateContactAction.create(viewer, {
  firstName: "Needle",
  lastName: "Stark",
  userId: userAction.builder,
});

const tx = new Transaction(viewer, [userAction, contactAction]);
await tx.run();

const createdUser = await userAction.editedEntX();
const createdContact = await contactAction.editedEntX();
```

## Notes

- All actions should be created with the same viewer type, and you usually pass the same viewer instance to `Transaction`.
- Preparation failures prevent writes; write failures roll back the write transaction. Result loading or observers after commit cannot undo it.
- When passing builders as input values, make sure your privacy policy allows builders (for example, `AllowIfBuilder`).
