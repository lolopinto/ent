---
sidebar_position: 16
---

# Transactions

Use `Transaction` when you need multiple actions' writes to succeed or fail together. By default, action preparation, validators and [Triggers](/docs/actions/triggers) run before the write transaction; the changesets returned by triggers share its writes. To include reads and action preparation, use `withTransaction` on PostgreSQL.

## Transaction-scoped reads and actions

`withTransaction` starts a transaction before its callback. Ent reads, privacy checks, validators, triggers, actions, edge writes and audit changesets inside the callback use the same reserved connection. Other asynchronous requests keep their own connections and caches. Existing actions and `Transaction.run()` retain their default behavior outside this API.

```ts
import { withTransaction } from "@snowtop/ent";

const result = await withTransaction(async () => {
  // Reload and reconstruct on EVERY attempt, including the first.
  const account = await Account.loadX(viewer, accountID);
  return EditAccountAction.create(viewer, account, {
    balance: account.balance - amount,
  }).saveX();
}, { maxRetries: 3 });
```

The default isolation level is `serializable`. PostgreSQL rejects conflicting transactions with SQLSTATE `40001`; deadlocks use `40P01`. `maxRetries` defaults to zero. Setting it retries the **whole callback** for those errors, with a new connection reservation, snapshot, loaders, and actions. Every operation enforcing the invariant must follow a compatible serializable or locking protocol; unrelated read-committed writers are not made safe automatically. See [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html).

Keep external side effects out of the callback and triggers when retrying. Send notifications through observers, or write an outbox record through an action in the same transaction. Sequence values and external systems are not rolled back. Unknown connection failures during `COMMIT` are not retried: the commit outcome may be unknown and must be reconciled before retrying externally.

### Require transactions for an action

An action with an invariant can fail closed on every normal action/builder save or changeset entrypoint:

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

`requiresTransaction()` may return `true` to require either supported isolation level, or `"serializable"` to reject weaker isolation. The guard runs before privacy, triggers and validators. Apply it to every action that can violate the invariant, including generated mutations exposed by GraphQL and alternative edit/delete paths. Raw SQL and custom action implementations that bypass the Ent orchestrator remain the application's responsibility.

Construct actions, builders, queries and loaders inside the callback; construct triggered changesets during that attempt. Load `existingEnt` inside the callback too. The runtime rejects cross-scope builders, changesets, standard cached loaders and preloaded Ents. Do not reuse a changeset or builder for another attempt. A GraphQL mutation wrapper must throw execution errors back out of the callback rather than returning an error-shaped success result; the callback's successful return requests commit. An action save, executor assembly, or SQL failure marks the scope failed even if caught, so earlier writes roll back. Regenerated `saveXFromID`/`saveFromID` helpers include their initial load, construction, and edge setup in this failure boundary; nullable missing results remain recoverable.

Guarded root actions must be prepared and saved **sequentially**. Do not prebuild two guarded roots with `changeset()`, put them together in `Transaction`, or call their saves in `Promise.all`; these modes reject and roll back the scope even when the actions might be independent. After each save, reconstruct queries and loaders and reload Ents needed for the next action. Reconstruct actions whose defaults or transforms have already been prepared by validation or a getter; those values cannot cross a guarded save. Prebuilt changesets and assembled executors, including ordinary unguarded actions, also expire after a guarded save and reject before pre-fetching or writing. This prevents two root validators or rollups from preparing against the same old state inside one transaction, where database isolation cannot detect the dependency.

Return child changesets from triggers; do not call child `save()`/`saveX()` or execute child executors during preparation. Distinct guarded actions conflict by default, including ancestors and descendants and actions separated by an unguarded wrapper. A parent and child removing different admin rows can both read the old count and violate the last-admin invariant. Preparation ancestry does not establish independence.

For actions whose independence is established, implement `getTransactionResources()` returning their invariant keys on every participating guarded action, including the parent:

```ts
getTransactionResources(): readonly string[] {
  // Only appropriate when this action's decisions depend on this account alone.
  return [`account:${this.builder.existingEnt.id}`];
}
```

Omitting the hook or returning `undefined` means a wildcard reservation, which conflicts with every other guarded action in the prepared graph, including actions with explicit keys. Non-empty arrays of non-empty strings declare explicit resources; only disjoint keyed actions may prepare together. The runtime snapshots these arrays. Ancestors and descendants must have disjoint resources too, and guarded roots remain sequential even with keys. There is no special wildcard string. Resource declarations must cover every dependency that another action could invalidate, including aggregate predicates and privacy checks, not just the row being written. For example, a parent changing only account A's balance and a child changing only account B's balance can declare separate account keys when neither decision depends on the other account. Two actions that both depend on the same admin count must share an invariant key and will be rejected; consolidate their decisions into one action or save sequentially and reload. Existing parent/child compositions that relied on ancestry alone must adopt this contract. A hook itself requires `withTransaction`, even without `requiresTransaction()`.

Standalone `valid()`, `validX()`, and `validWithErrors()` calls inside a scope use the same preparation guards. Their child changesets and reservations are temporary and are discarded after validation, including when validation reports errors. A subsequent save reruns validation and prepares a fresh child graph. Changesets captured from standalone validation cannot execute. This cleanup applies to retained children and grandchildren too. It waits for participating SQL, Ent/privacy, and loader reads used to set up children before closing the validation scope, even when another child has already failed. The original validation error is preserved; a late SQL or composition failure still aborts the transaction.

Field defaults and action/schema transformation results remain memoized, preserving established builder IDs and applying transformed input only once. A transformation's `changeset` factory runs within each validation/save preparation in a scope and must build a fresh child changeset; computing fields through a getter alone does not execute that factory. Edges established by default-field `updateInput` are retained, while edges to probe-created children are discarded with the probe. Validation can still change action fields through existing trigger behavior; it is not a general rollback of application state. Await validation before building or saving the same action. Normal validation errors can be inspected and corrected; SQL failures and invalid transaction composition still fail the transaction.

Known repeated row updates/deletes through different builders in a guarded tree are also rejected when executing; skipped conditional operations and edge-only changes do not count as row mutations. Consolidate overlapping absolute updates into one child action. Explicit resource declarations must include every shared invariant dependency: keys are an application contract, not inferred SQL dependencies. Existing unguarded action batches retain their behavior.

### Explicit locks and composition

For a read-committed workflow, lock the invariant's stable owner row **before** reading data used for decisions, and have every competing writer acquire that same lock. Locking only rows about to be deleted cannot protect an empty set or a last-admin count. Acquire multiple locks in a consistent order.

```ts
await withTransaction(async (tx) => {
  await tx.query("SELECT id FROM accounts WHERE id = $1 FOR UPDATE", [accountID]);
  const account = await Account.loadX(viewer, accountID);
  await EditAccountAction.create(viewer, account, {
    balance: account.balance - amount,
  }).saveX();
}, { isolationLevel: "read committed" });
```

The callback receives `query`, `queryAll`, `exec`, `attempt` (zero-based), and `isolationLevel`. SQL is parameterized using PostgreSQL placeholders. Low-level SQL does not apply Ent privacy or create audit actions; use it for locks and continue using Ent actions for mutations. Do not send transaction-control SQL, use DB handles captured before the callback, or change global DB configuration while a scope is active.

Nested `withTransaction` calls are rejected; there are no savepoints or independent inner commits. Composed services can inspect `getTransactionScope()` (exported from `@snowtop/ent`), check its `isolationLevel`, and call their implementation directly when an appropriate scope already exists. `new Transaction(viewer, actions).run()` joins the current scope.

### Caches, results, and observers

- Cached queries and loaders belong to the guarded-action generation in which they were created. Reusing them after a guarded save, or letting a pending read span that save, rejects and marks the scope failed even if caught. Await reads before saving, then create fresh readers for the next action. Same-generation reuse and ordinary outside-scope behavior are unchanged. Turning previously read rows into Ents preserves their original transaction and generation, including rows returned by `tx.query`, `tx.queryAll`, and `tx.exec`. Supplied Ents and `sourceEnt()` results used by edge-query privacy must belong to the current generation.
- Standard Ent, object, count, query and edge-metadata caches are isolated for each attempt. Transaction rows never populate outside request caches. Participating request caches are invalidated after commit; rollback leaves them untouched. SQL calls conservatively invalidate the attempt's caches, so raw writes and reads after acquiring locks see fresh data.
- `saveX()` results inside the callback are provisional. A thrown result-loading or post-fetch error marks the owning scope failed, so all writes roll back even when the caller catches the error. This includes direct `editedEntX()` failures and exceptions from `viewerForEntLoad` or result privacy checks. Normal `null` results from nullable `save()`/`editedEnt()` do not fail the scope. Direct result-loading failures from getters used after their owning commit cannot undo it or fail a different transaction. Queries and actions explicitly executed by application privacy callbacks inside a later scope still follow that active scope's failure rules. Do not expose callback results until `withTransaction` resolves. After commit, already returned Ent objects remain snapshots; reload them inside a new scope to edit them again.
- Calling `editedEnt()`/`editedEntX()` again reads the action's retained result row. It preserves that write's transaction and generation, so an old snapshot cannot become a fresh mutation input by being inspected inside a later scope or after another guarded root saves. Immediate results of the latest completed action graph remain usable in that generation; reload from the database after later guarded writes.
- Action observers are queued until the owning commit, then run outside its scope after the connection is released. Rollback and failed retry attempts discard observers. Observer errors keep the existing best-effort policy and never retry committed work. Observers cannot roll back a commit and are not a durable exactly-once delivery mechanism.
- Await all work inside the callback. Unawaited in-flight SQL causes rollback, and inherited asynchronous work cannot use a closed scope. Detached jobs must start from their own request context.

### Supported runtimes

PostgreSQL with Node's `pg` driver and Bun's `pg` or native Bun SQL driver is supported. SQLite is explicitly rejected: its existing shared synchronous connection cannot safely hold an asynchronous scoped transaction across concurrent requests. `repeatable read` and other isolation modes are rejected. Existing SQLite action transactions continue to work normally.

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
