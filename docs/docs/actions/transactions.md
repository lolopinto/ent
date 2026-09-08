---
sidebar_position: 16
---

# Transactions

Use `Transaction` to commit or roll back multiple actions' writes together. Before writing, Ent computes field defaults and transformations, checks privacy policies, runs [triggers](/docs/actions/triggers), and validates the resulting input. These steps prepare the action and its child changesets.

By default, preparation runs before the write transaction. To include preparation and the reads it uses in one PostgreSQL transaction, wrap the operation in `withTransaction`.

## Transaction-scoped reads and actions

`withTransaction` starts a transaction before calling its callback. Ent loads, privacy checks, validators, triggers, actions, edge writes, and audit changesets in the callback use one reserved connection. Other asynchronous requests use their own connections and caches. Outside a scope, actions and `Transaction.run()` keep their existing behavior.

```ts
import { withTransaction } from "@snowtop/ent/action";

const result = await withTransaction(async () => {
  // Load the account and create the action on every attempt.
  const account = await Account.loadX(viewer, accountID);
  return EditAccountAction.create(viewer, account, {
    balance: account.balance - amount,
  }).saveX();
}, { maxRetries: 3 });
```

### Transaction lifecycle

An ordinary action starts its transaction after preparation:

```text
Load → Prepare → BEGIN → Write → COMMIT → Load result → Observe
```

`withTransaction` starts earlier and owns the transaction until the callback finishes:

```text
Reserve connection → BEGIN
                       │
                       ▼
             Run the callback
             ├─ Load rows and create actions
             ├─ Prepare defaults, transformations, privacy, triggers, and validation
             ├─ Execute the action graph's writes
             └─ Reload results and apply result privacy
                       │
                       ▼
             Callback returns
             ├─ Pending SQL or failed scope → ROLLBACK
             └─ Successful scope → COMMIT
                                      │
                                      ▼
                    Release connection → Invalidate request caches
                                      → Run observers → Return result
```

The callback can save multiple actions. After a guarded save, reload the data for the next guarded action and prepare it from that data. All saves remain provisional until the outer `COMMIT` succeeds.

If an attempt fails, Ent rolls it back, releases the connection, and discards its caches and observers. An eligible retry starts the whole callback again with fresh attempt state. A failure with no eligible retry rejects `withTransaction`.

### Isolation and retries

An invariant is an application rule that must remain true, such as requiring at least one account administrator. Actions often check an invariant by reading data, validating a decision, and writing a result.

`withTransaction` defaults to `serializable` isolation. At PostgreSQL's usual `read committed` isolation level, concurrent actions can both pass validation using the same old state. Serializable isolation lets PostgreSQL detect conflicting decisions and abort an attempt. Callers can enable retries of the whole callback to handle these failures.

This default applies only to `withTransaction`. Ordinary saves and `Transaction.run()` outside a scope use their existing write transactions and the connection's configured isolation level. Set `isolationLevel: "read committed"` when you use a compatible locking protocol, as described in [Explicit locks and composition](#explicit-locks-and-composition).

PostgreSQL reports serialization failures with SQLSTATE `40001` and deadlocks with `40P01`. `maxRetries` defaults to zero. If you enable retries, either error can restart the callback with a new connection reservation, snapshot, and caches. Load Ents and construct actions again inside that callback.

Every writer that can violate an invariant must follow a compatible serializable or locking protocol. This API doesn't protect unrelated writers that use read committed isolation. For details, see [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html).

If you enable retries, keep external side effects out of the callback and triggers. Send notifications through observers, or use an action to write an outbox record in the same transaction. Rollback doesn't undo sequence values or changes to external systems. If a connection failure during `COMMIT` leaves the outcome unknown, `withTransaction` doesn't retry. Determine the outcome before retrying externally. Connection cleanup failures also prevent retries; a failure after a successful commit cannot undo it.

### Require transactions for an action

An action can require a transaction for its normal action save, builder save, and changeset entry points:

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

Return `true` from `requiresTransaction()` to accept either supported isolation level, or return `"serializable"` to require serializable isolation. Ent checks this requirement before running action privacy checks, triggers, or validators. Apply it to every action that can violate the invariant, including generated GraphQL mutations and other edit or delete paths. Protect raw SQL and custom actions that bypass the Ent orchestrator in your application.

In this guide, a *guarded action* requires a transaction or declares invariant resources through `getTransactionResources()`.

Construct actions, builders, queries, and loaders inside the callback. Load `existingEnt` there too, and create triggered changesets during the same attempt. Ent rejects builders, changesets, standard cached loaders, and preloaded Ents that belong to another scope. Rebuild them for each retry.

An action save, executor assembly, or SQL failure marks the scope as failed even if you catch the error. Earlier writes then roll back. Regenerated `saveXFromID` and `saveFromID` helpers include the initial load, construction, and edge setup in this failure handling. Generated edge-group instance saves and changesets also include edge setup. A missing target returned by a nullable helper remains recoverable.

A GraphQL wrapper must throw execution errors out of the callback. Returning an object that contains an error still counts as a successful return and requests a commit, unless an action or SQL failure has already marked the scope as failed. During standalone validation, a child changeset can report a correctable validation error without failing the transaction. SQL errors always fail it.

#### Prepare guarded root actions sequentially

Prepare and save one guarded root action at a time. Don't prebuild two guarded roots with `changeset()`, combine them in `Transaction`, or call their saves in `Promise.all`. These operations reject and roll back the scope even if the actions appear independent.

Each guarded save advances the transaction's *generation*, which identifies the reads and prepared values that remain usable for the next action. After a guarded save, create fresh queries and loaders and reload the Ents needed by the next action. Reconstruct actions whose defaults or transformations were already prepared by validation or a getter.

Prebuilt changesets and assembled executors also expire after a guarded save, including those for ordinary unguarded actions. They reject before fetching or writing data. These checks prevent multiple root actions from making decisions against the same old state within one transaction, where database isolation can't detect the dependency.

#### Compose guarded actions

Return child changesets from triggers. Don't call a child's `save()` or `saveX()` method or execute its executor during preparation.

Distinct guarded actions conflict by default, including ancestors, descendants, and actions separated by an unguarded wrapper. For example, a parent and child that remove different administrators can both read the old administrator count and violate the requirement to keep one administrator. Their parent-child relationship doesn't establish independence.

If the actions are independent, implement `getTransactionResources()` on every participating guarded action, including the parent. Return keys for the invariants that each action depends on:

```ts
getTransactionResources(): readonly string[] {
  // Use this key only if the action's decisions depend on this account alone.
  return [`account:${this.builder.existingEnt.id}`];
}
```

Return a non-empty array of non-empty strings. Ent copies the array and permits actions to prepare together only when their resource keys don't overlap. This rule also applies to ancestors and descendants. Guarded roots must still run sequentially, even with explicit keys.

Ent reserves the guarded root before invoking `getTransactionResources()`. If the hook returns a promise, other guarded roots can't prepare while it resolves. The hook's reads and other awaited work must stay within one generation.

If you omit the hook or return `undefined`, the action reserves a wildcard resource that conflicts with every other guarded action in the graph. There is no special wildcard string. Defining the hook requires `withTransaction`, even without `requiresTransaction()`.

Declare every dependency that another action could invalidate, including aggregate conditions and privacy checks. A row key alone is sufficient only when the action's decisions depend on that row alone. For example, a parent that changes account A's balance and a child that changes account B's balance can declare separate account keys if neither decision depends on the other account.

Actions that depend on the same administrator count must share an invariant key and cannot prepare together. Consolidate their decisions into one action, or save them sequentially and reload between saves. Parent-child compositions that relied on ancestry alone must adopt this contract.

During execution, Ent also rejects known updates or deletes of the same row through different builders in a guarded graph. Skipped conditional operations and edge-only changes don't count as row mutations. Consolidate overlapping absolute updates into one child action. Ent doesn't infer invariant keys from SQL dependencies; your application must declare every shared dependency. Existing unguarded action batches keep their behavior.

#### Validate without saving

Standalone `valid()`, `validX()`, and `validWithErrors()` calls inside a scope use the same preparation guards. Their child changesets and resource reservations are temporary. After validation, Ent discards them, including when validation reports an error. This cleanup includes retained children and grandchildren. A subsequent save reruns validation and prepares a fresh child graph. Changesets captured during standalone validation cannot execute.

Before closing validation, Ent waits for participating SQL, Ent, privacy, and loader reads used to set up children. This includes pending privacy checks reused from an Ent cache. Ent waits even if another child has already failed and preserves the original validation error. A later SQL or composition failure still aborts the transaction.

Field defaults and action or schema transformation results remain memoized. This preserves builder IDs and applies transformed input once. A transformation's `changeset` factory runs during each validation or save preparation inside a scope and must create a fresh child changeset. Reading fields through a getter alone doesn't run the factory.

Cleanup preserves edges established by default-field `updateInput` and discards edges to children created during standalone validation. Validation can still change action fields through existing trigger behavior; it doesn't restore application state in general. Await validation before building or saving the same action. You can inspect and correct normal validation errors. SQL failures and invalid transaction composition still fail the transaction.

### Explicit locks and composition

If you use read committed isolation, lock a stable row that owns the invariant before reading data used for decisions. Every competing writer must acquire the same lock. Locking only rows about to be deleted cannot protect an empty set or the requirement to keep one administrator. Acquire multiple locks in a consistent order.

```ts
await withTransaction(async (tx) => {
  await tx.query("SELECT id FROM accounts WHERE id = $1 FOR UPDATE", [accountID]);
  const account = await Account.loadX(viewer, accountID);
  await EditAccountAction.create(viewer, account, {
    balance: account.balance - amount,
  }).saveX();
}, { isolationLevel: "read committed" });
```

The callback receives `query`, `queryAll`, `exec`, the zero-based `attempt` number, and `isolationLevel`. Use PostgreSQL placeholders to parameterize SQL. These SQL methods don't apply Ent privacy or create audit actions. Use them for locks, then use Ent actions for mutations.

While a scope is active, don't send SQL that controls the transaction, use DB handles captured before the callback, or change global DB configuration.

`withTransaction` rejects nested calls and doesn't support savepoints or independent inner commits. Composed services can inspect `getTransactionScope()` from `@snowtop/ent/action`, check its `isolationLevel`, and call their implementation directly when an appropriate scope already exists. `new Transaction(viewer, actions).run()` joins the current scope.

### Caches, results, and observers

#### Queries and caches

Cached queries and loaders belong to the generation in which you create them. Reusing them after a guarded save, or letting a pending read span that save, marks the scope as failed even if you catch the error. Await reads before saving, then create fresh readers for the next action. You can reuse readers within one generation. Their behavior outside a scope is unchanged.

Rows retain the transaction and generation in which they were read, including rows returned by `tx.query`, `tx.queryAll`, and `tx.exec`. Converting a row to an Ent preserves that origin. Supplied Ents and `sourceEnt()` results used by edge-query privacy must belong to the current generation.

`applyPrivacyPolicyForRow()`, `applyPrivacyPolicyForRows()`, `loadDerivedEnt()`, and `loadDerivedEntX()` preserve the input row's transaction and generation before running privacy checks. If the row has no recorded transaction origin, the resulting Ent remains unscoped and cannot be used in a guarded save. Load a tracked row inside the callback instead of copying data or reusing untracked data.

Standard Ent, object, count, query, and edge metadata caches are isolated for each attempt. Transaction rows never populate request caches outside the scope. Commit invalidates participating request caches; rollback leaves them unchanged.

Framework reads preserve other cached results in the attempt. Raw SQL calls conservatively invalidate caches for every participating viewer, including calls through `tx.query`, `tx.queryAll`, `tx.exec`, `DB.getPool()`, and `performRawQuery()`. Framework writes also invalidate these caches, so reads after writes or explicit locks see fresh data.

#### Results

Results from `saveX()` inside the callback are provisional. A result-loading or post-fetch error marks the owning scope as failed, so all writes roll back even if you catch the error. This includes direct `editedEntX()` failures and exceptions from `viewerForEntLoad` or result privacy checks. Normal `null` results from nullable `save()` and `editedEnt()` calls don't fail the scope.

A result getter used after its owning commit cannot undo that commit or fail a different transaction. Queries and actions that application privacy callbacks explicitly execute in a later scope still follow that scope's failure rules.

Expose callback results only after `withTransaction` resolves. After commit, returned Ent objects remain snapshots. Reload them in a new scope before editing them again.

Calling `editedEnt()` or `editedEntX()` again reads the action's retained result row and preserves that write's transaction and generation. Inspecting an old snapshot inside a later scope or after another guarded save doesn't make it a fresh mutation input. Results of the latest completed action graph remain usable in that generation.

Inside a scope, standard actions reload their result rows after all graph writes and before result privacy checks. This adds one row reload per executed node operation that returns a row. Results include changes made by other actions or raw changesets in the graph. The reload uses the stored row's primary key, including when an upsert matched an existing row. Edge-only actions and actions skipped by silent privacy checks also reload their result rows. After later guarded writes, reload from the database.

#### Observers and asynchronous work

Action observers run after the owning transaction commits and releases its connection. They run outside that scope. Rollback and failed retry attempts discard observers.

Observer errors follow the existing best-effort policy and never cause committed work to retry. Observers cannot roll back a commit and don't guarantee durable, exactly-once delivery.

Await all work inside the callback. SQL still in progress when the callback returns causes rollback. Asynchronous work that inherits a scope cannot use it after it closes. Detached jobs must start with their own request context.

### Supported runtimes

`withTransaction` supports PostgreSQL with Node's `pg` driver and Bun's `pg` or native SQL driver. It rejects SQLite because the existing shared synchronous connection cannot safely hold an asynchronous transaction across concurrent requests. Existing SQLite action transactions continue to work normally.

The supported isolation levels are `serializable` and `read committed`. Other levels, including `repeatable read`, are rejected.

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
