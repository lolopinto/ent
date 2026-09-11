---
sidebar_position: 16
---

# Transactions

Use `Transaction` to commit or roll back multiple actions' writes together. Before writing, Ent computes field defaults and transformations, checks privacy policies, runs [triggers](/docs/actions/triggers), and validates the resulting input. These steps prepare the action and its child changesets.

By default, preparation runs before the write transaction. To include preparation and the reads it uses in one PostgreSQL transaction, wrap the operation in `withTransactionScope`.

## Transaction-scoped reads and actions

`withTransactionScope` starts a transaction before calling its callback. Ent loads, privacy checks, validators, triggers, actions, edge writes, and audit changesets in the callback use one reserved connection. Other asynchronous requests use their own connections and caches. Outside a scope, actions and `Transaction.run()` keep their existing behavior.

```ts
import { withTransactionScope } from "@snowtop/ent/action";

const result = await withTransactionScope(async () => {
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

`withTransactionScope` starts earlier and owns the transaction through final validation and commit:

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
             ├─ Pending work or failed scope → ROLLBACK
             └─ Finish deferred database constraints and triggers
                       │
                       ▼
             Run action validateBeforeCommit hooks
             ├─ Read final state on the same connection, without caches
             ├─ Failed check → ROLLBACK
             └─ Successful checks → COMMIT
                                      │
                                      ▼
                    Release connection → Invalidate request caches
                                      → Run observers → Return result
```

The callback can save multiple actions. After each save, reload the data for the next action and prepare it from that data. All saves remain provisional until the outer `COMMIT` succeeds.

If an attempt fails, Ent rolls it back, releases the connection, and discards its caches and observers. An eligible retry starts the whole callback again with fresh attempt state. A failure with no eligible retry rejects `withTransactionScope`.

### Isolation and retries

An invariant is an application rule that must remain true, such as requiring at least one account administrator. Actions often check an invariant by reading data, validating a decision, and writing a result.

`withTransactionScope` defaults to `serializable` isolation. At PostgreSQL's usual `read committed` isolation level, concurrent actions can both pass validation using the same old state. Serializable isolation lets PostgreSQL detect conflicting decisions and abort an attempt. Callers can enable retries of the whole callback to handle these failures.

This default applies only to `withTransactionScope`. Ordinary saves and `Transaction.run()` outside a scope use their existing write transactions and the connection's configured isolation level. Set `isolationLevel: "read committed"` when you use a compatible locking protocol, as described in [Explicit locks and composition](#explicit-locks-and-composition).

PostgreSQL reports serialization failures with SQLSTATE `40001` and deadlocks with `40P01`. `maxRetries` defaults to zero. If you enable retries, either error can restart the callback with a new connection reservation, snapshot, and caches. Load Ents and construct actions again inside that callback.

Every writer that can violate an invariant must follow a compatible serializable or locking protocol. This API doesn't protect unrelated writers that use read committed isolation. For details, see [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html).

If you enable retries, keep external side effects out of the callback and triggers. Send notifications through observers, or use an action to write an outbox record in the same transaction. Rollback doesn't undo sequence values or changes to external systems. If a connection failure during `COMMIT` leaves the outcome unknown, `withTransactionScope` doesn't retry. Determine the outcome before retrying externally. Connection cleanup failures also prevent retries; a failure after a successful commit cannot undo it.

### Require a scope for an action

An action can require a scope for its action save, builder save, changeset, and standalone validation entry points:

```ts
export default class RemoveAdminAction extends RemoveAdminActionBase {
  requiresTransactionScope() {
    return "serializable" as const;
  }
}

await withTransactionScope(
  () => RemoveAdminAction.saveXFromID(viewer, fundID, { adminID }),
  { maxRetries: 3 },
);
```

Return `true` from `requiresTransactionScope()` to accept either supported isolation level, or return `"serializable"` to require serializable isolation. Ent checks this requirement before running action privacy checks, triggers, or validators. Apply it to every action that can violate the invariant, including generated GraphQL mutations and other edit or delete paths. Protect raw SQL and custom actions that bypass the Ent orchestrator in your application.

`requiresTransactionScope()` checks a precondition. Every action inside a scope follows the same preparation and freshness rules, whether or not it declares this method. The method does not start a scope automatically.

Construct actions, builders, queries, and loaders inside the callback. Load `existingEnt` there too, and create triggered changesets during the same attempt. Ent rejects builders, changesets, standard cached loaders, and preloaded Ents that belong to another scope. Rebuild them for each retry.

An action save, executor assembly, or SQL failure marks the scope as failed even if you catch the error. Earlier writes then roll back. Regenerated `saveXFromID` and `saveFromID` helpers include the initial load, construction, and edge setup in this failure handling. Generated edge-group instance saves and changesets also include edge setup. A missing target returned by a nullable helper remains recoverable.

A GraphQL wrapper must throw execution errors out of the callback. Returning an object that contains an error still counts as a successful return and requests a commit, unless an action or SQL failure has already marked the scope as failed. During standalone validation, a child changeset can report a correctable validation error without failing the transaction. SQL errors always fail it.

#### Prepare root actions sequentially

A *root action* is an action the caller saves directly. Its triggers can return *child changesets*, which can have children of their own. Prepare and save one root at a time inside a scope. Don't prebuild multiple roots with `changeset()`, combine them in `Transaction`, or save them in `Promise.all`. These operations reject and roll back the scope.

```ts
await withTransactionScope(async () => {
  await RemoveAdminAction.saveXFromID(viewer, accountID, {
    adminID: firstAdminID,
  });

  // Load and validate against the preceding action's writes.
  await RemoveAdminAction.saveXFromID(viewer, accountID, {
    adminID: secondAdminID,
  });
});
```

Each save advances the transaction's *generation*, which identifies the reads and prepared values that remain usable for the next action. After a save, create fresh queries and loaders and reload the Ents needed by the next action. Reconstruct actions whose defaults or transformations were already prepared by validation or a getter. Prebuilt changesets and assembled executors expire after a save and reject before fetching or writing data.

#### Compose child actions

Return child changesets from triggers. Don't call a child's `save()` or `saveX()` method or execute its executor during preparation. A parent and its children prepare as one graph before that graph's writes. Children don't automatically observe their siblings' writes during preparation.

Use successive root saves when one decision must observe another action's writes. Use an action's final validation hook when a business rule depends on the completed operation's database state.

Ent rejects known updates or deletes of the same row through different builders in one graph. Skipped conditional operations and edge-only changes don't count as row mutations. Consolidate overlapping absolute updates into one action. Final validation does not repair a lost calculation, such as two children both subtracting from the same original balance.

#### Validate the final state before commit

Define `validateBeforeCommit(context)` on an action to check a business rule after all writes in the scope. Ent registers the check automatically when the action executes, including when a trigger returns it as a child or grandchild.

```ts
import type { ScopeValidationContext } from "@snowtop/ent/action";

export default class RemoveAdminAction extends RemoveAdminActionBase {
  requiresTransactionScope() {
    return "serializable" as const;
  }

  async validateBeforeCommit(context: ScopeValidationContext): Promise<void> {
    const result = await context.query(
      `SELECT count(*)::int AS count
       FROM account_admins WHERE account_id = $1`,
      [this.builder.existingEnt.id],
    );
    if (result.rows[0].count === 0) {
      throw new Error("The account must have at least one administrator.");
    }
  }
}
```

After the callback returns, Ent finishes deferred database constraints and triggers, then runs every registered hook before committing. Each check sees all writes from the callback, including later root actions and database triggers. Throw an error to roll back the entire scope. Observers run only after a successful commit.

Declaring this hook requires a scope even without `requiresTransactionScope()`. An explicit isolation requirement still applies. The hook accepts either supported isolation level unless the action requires serializable isolation. A final check at read committed isolation still needs a compatible locking protocol to coordinate concurrent writers.

The context exposes `query`, `queryAll`, `attempt`, and `isolationLevel`. Its queries use the reserved transaction connection and accept one read statement: `SELECT`, a read-only `WITH` query, or `VALUES`. Parameterize values. Use parameters, dollar-quoted strings, or explicit PostgreSQL `E` strings for values containing backslashes. The context cannot save actions, issue writes, control the transaction, or be reused after final validation. PostgreSQL read-only mode also rejects persistent writes made by functions called from a validation query.

Ent reads inside the hook bypass request caches, scope caches, loader caches, query/count caches, and cached privacy results. Applicable privacy checks still run. Create queries and loaders in the hook and query using identifiers. Previously loaded Ents, captured promises, and application memoization are not fresh database state. Direct SQL does not apply Ent privacy.

An uncached read still follows PostgreSQL isolation rules. At serializable isolation, it sees the transaction snapshot and the transaction's own writes; it does not necessarily see other transactions' later commits.

Checks run once for each executed action instance, including edge-only actions. Ent does not deduplicate rules across different actions or identifiers. Actions skipped by conditional execution or silent privacy failure do not register checks. Standalone validation and unexecuted changesets do not register checks. A retry rebuilds the actions and registrations for that attempt.

For example, two children can each approve removing one of two administrators during preparation. Final validation then reads zero and rejects both removals. Replacing the only administrator can succeed if later writes restore a valid final state. Immediate validators and database constraints continue to apply; they do not become deferred automatically.

Final validation supplements input validation, privacy, and correct calculations. Apply the rule to every relevant action and coordinate writers that bypass those actions. Ent does not infer missing business rules from SQL or automatically isolate children from each other.

#### Validate without saving

Standalone `valid()`, `validX()`, and `validWithErrors()` calls inside a scope use the same preparation guards. Their child changesets and root preparation reservations are temporary. After validation, Ent discards them, including when validation reports an error. This cleanup includes retained children and grandchildren. A subsequent save reruns validation and prepares a fresh child graph. Changesets captured during standalone validation cannot execute.

Before closing validation, Ent waits for participating SQL, Ent, privacy, and loader reads used to set up children. This includes pending privacy checks reused from an Ent cache. Ent waits even if another child has already failed and preserves the original validation error. A later SQL or composition failure still aborts the transaction.

Field defaults and action or schema transformation results remain memoized. This preserves builder IDs and applies transformed input once. A transformation's `changeset` factory runs during each validation or save preparation inside a scope and must create a fresh child changeset. Reading fields through a getter alone doesn't run the factory.

Cleanup preserves edges established by default-field `updateInput` and discards edges to children created during standalone validation. Validation can still change action fields through existing trigger behavior; it doesn't restore application state in general. Await validation before building or saving the same action. You can inspect and correct normal validation errors. SQL failures and invalid transaction composition still fail the transaction.

### Explicit locks and composition

If you use read committed isolation, lock a stable row that owns the invariant before reading data used for decisions. Every competing writer must acquire the same lock. Locking only rows about to be deleted cannot protect an empty set or the requirement to keep one administrator. Acquire multiple locks in a consistent order.

```ts
await withTransactionScope(async (tx) => {
  await tx.query("SELECT id FROM accounts WHERE id = $1 FOR UPDATE", [accountID]);
  const account = await Account.loadX(viewer, accountID);
  await EditAccountAction.create(viewer, account, {
    balance: account.balance - amount,
  }).saveX();
}, { isolationLevel: "read committed" });
```

The callback receives `query`, `queryAll`, `exec`, the zero-based `attempt` number, and `isolationLevel`. Use PostgreSQL placeholders to parameterize SQL. These SQL methods don't apply Ent privacy or create audit actions. Use them for locks, then use Ent actions for mutations.

While a scope is active, don't send SQL that controls the transaction, use DB handles captured before the callback, or change global DB configuration.

`withTransactionScope` rejects nested calls and doesn't support savepoints or independent inner commits. Composed services can inspect `getTransactionScope()` from `@snowtop/ent/action`, check its `isolationLevel`, and call their implementation directly when an appropriate scope already exists. `new Transaction(viewer, actions).run()` joins the current scope, but cannot prepare multiple roots there. Use sequential saves or return child changesets from one root.

### Caches, results, and observers

#### Queries and caches

Cached queries and loaders belong to the generation in which you create them. Reusing them after a save, or letting a pending read span that save, marks the scope as failed even if you catch the error. Await reads before saving, then create fresh readers for the next action. You can reuse readers within one generation. Their behavior outside a scope is unchanged.

Rows retain the transaction and generation in which they were read, including rows returned by `tx.query`, `tx.queryAll`, and `tx.exec`. Converting a row to an Ent preserves that origin. Supplied Ents and `sourceEnt()` results used by edge-query privacy must belong to the current generation.

`applyPrivacyPolicyForRow()`, `applyPrivacyPolicyForRows()`, `loadDerivedEnt()`, and `loadDerivedEntX()` preserve the input row's transaction and generation before running privacy checks. If the row has no recorded transaction origin, the resulting Ent remains unscoped and cannot be used in a save inside a scope. Load a tracked row inside the callback instead of copying data or reusing untracked data.

Standard Ent, object, count, query, and edge metadata caches are isolated for each attempt. Transaction rows never populate request caches outside the scope. Commit invalidates participating request caches; rollback leaves them unchanged.

Framework reads preserve other cached results in the attempt. Raw SQL calls conservatively invalidate caches for every participating viewer, including calls through `tx.query`, `tx.queryAll`, `tx.exec`, `DB.getPool()`, and `performRawQuery()`. Framework writes also invalidate these caches, so reads after writes or explicit locks see fresh data.

#### Results

Results from `saveX()` inside the callback are provisional. A result-loading or post-fetch error marks the owning scope as failed, so all writes roll back even if you catch the error. This includes direct `editedEntX()` failures and exceptions from `viewerForEntLoad` or result privacy checks. Normal `null` results from nullable `save()` and `editedEnt()` calls don't fail the scope.

A result getter used after its owning commit cannot undo that commit or fail a different transaction. Queries and actions that application privacy callbacks explicitly execute in a later scope still follow that scope's failure rules.

Expose callback results only after `withTransactionScope` resolves. After commit, returned Ent objects remain snapshots. Reload them in a new scope before editing them again.

Calling `editedEnt()` or `editedEntX()` again reads the action's retained result row and preserves that write's transaction and generation. Inspecting an old snapshot inside a later scope or after another save doesn't make it a fresh mutation input. Results of the latest completed action graph remain usable in that generation.

Inside a scope, standard actions reload their result rows after all graph writes and before result privacy checks. This adds one row reload per executed node operation that returns a row. Results include changes made by other actions or raw changesets in the graph. The reload uses the stored row's primary key, including when an upsert matched an existing row. Edge-only actions and actions skipped by silent privacy checks also reload their result rows. After later writes, reload from the database.

#### Observers and asynchronous work

Action observers run after the owning transaction commits and releases its connection. They run outside that scope. Rollback and failed retry attempts discard observers.

Observer errors follow the existing best-effort policy and never cause committed work to retry. Observers cannot roll back a commit and don't guarantee durable, exactly-once delivery.

Await all work inside the callback. Actions or SQL still in progress when the callback returns cause rollback. Final validation must also await all participating reads. Asynchronous work that inherits a scope cannot use it after it closes. Detached jobs must start with their own request context.

### Supported runtimes

`withTransactionScope` supports PostgreSQL with Node's `pg` driver and Bun's `pg` or native SQL driver. It rejects SQLite because the existing shared synchronous connection cannot safely hold an asynchronous transaction across concurrent requests. Existing SQLite action transactions continue to work normally.

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
