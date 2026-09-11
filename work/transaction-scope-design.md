# Transaction scope decisions

- Objective: Implement the agreed transaction scope API and action-owned final validation.
- Status: complete
- Updated: 2026-09-10
- Context: `codex/transaction-scoped-actions`, [PR #2035](https://github.com/lolopinto/ent/pull/2035).

## Accepted contract

1. Use `withTransactionScope` for the callback boundary. It begins before loads and action preparation and commits after final validation. Ordinary action transactions outside a scope retain their behavior.
2. Use `requiresTransactionScope()` as an action precondition. Return `true` to accept either supported isolation level or `"serializable"` to require serializable isolation. The method does not create a scope or select different preparation rules.
3. Apply the same rules to every action inside a scope. Prepare and save one root at a time. Reload data and create fresh readers after each save. Reject concurrent roots, prebuilt batches of roots, and multiple roots in `Transaction.run()` inside a scope.
4. Preserve trigger children as one preparation graph. Children can prepare together before the graph writes. They do not observe earlier siblings' writes during preparation.
5. Remove `getTransactionResources()`. Use ordered saves when decisions depend on earlier writes. Use final validation for rules about the operation's completed database state. Keep the duplicate row-mutation guard within each graph.
6. Define `validateBeforeCommit(context: ScopeValidationContext)` on the action. Declaring this hook requires a scope; an explicit isolation requirement still applies. Ent registers the hook for executed actions, including children and grandchildren.
7. Run hooks after the callback and deferred database constraints and triggers, before commit. Check the complete final state on the same reserved connection. Hook errors roll back the whole scope. Do not register checks from discarded standalone validation, unexecuted changesets, or actions skipped by conditional execution or silent privacy failure.
8. Bypass supported Ent, request, scope, loader, query/count, and privacy result caches during final validation. Preserve privacy enforcement. Ordinary reads earlier in the scope keep attempt-local caches. Capture identifiers and query in the hook; arbitrary application memoization and captured Ent objects are not fresh reads.
9. Make final validation read-only. Expose `query`, `queryAll`, `attempt`, and `isolationLevel`. Accept one read statement per query; reject action preparation, action saves, writes, and transaction control. PostgreSQL read-only mode protects persistent tables. Expire the context when validation ends.
10. Keep PostgreSQL support, serializable isolation by default, optional whole-callback retries, zero retries by default, and no nested scopes or savepoints. Rebuild actions, reads, and registrations on every retry. Observers run after a successful commit and connection release.

The framework comparison has been removed. The public guide is [Transactions](../docs/docs/actions/transactions.md).

## Lifecycle

```text
Ordinary action:
load -> prepare parent and children -> BEGIN -> writes -> COMMIT -> observers

Transaction scope:
BEGIN
  load -> prepare root A and children -> write their changes
  load -> prepare root B and children -> write their changes
  finish deferred database constraints and triggers
  validateBeforeCommit for each executed action
    uncached reads on the same connection
COMMIT
observers
```

Final validation supplements privacy, input validation, and correct calculations. It does not infer missing rules or repair arbitrary stale calculations. Competing writers still need compatible serializable isolation or locking. An uncached serializable read sees the transaction snapshot and its own writes, rather than every later external commit.

## Implementation and review checklist

- Review baseline: `364350d9228f5ceb69c9e3b08d81a6d3d047a7f1`. Keep this baseline throughout the loop.
- Original PR base for interaction checks: `37309a0c8b81fa071d170a5827530a5d283d5a52`.
- Initial local changes: This untracked decision record only. Original copy: `/private/tmp/ent-scope-validation/design-before.md`.
- Evidence directory: `/private/tmp/ent-scope-validation/`.
- Review standard: `review-fix-loop` with `review-code`; Google writing style for introduced comments and documentation.
- [x] Remove the framework comparison and record the accepted contract.
- [x] Rename the scope APIs and remove resource declarations.
- [x] Apply preparation and freshness checks uniformly inside scopes.
- [x] Register action-owned final validators and run them before commit.
- [x] Enforce uncached reads and prevent writes during final validation.
- [x] Add package regressions, runtime driver coverage, and a generated consumer example.
- [x] Update public documentation and the changelog.
- [x] Review the full implementation diff and original PR interactions.
- [x] Repair confirmed findings and run repository-required verification.
- [x] Review the full target again after repairs and record the final result.

## Verification

- Baseline: 35 tests passed across the previous resource and lifecycle suites.
- Final package run: 3,735 tests passed across 101 suites; one existing skipped test.
- Focused final validation: 39 tests passed, including concurrent serializable final checks and late callback work.
- TypeScript compilation, package lint, generator package tests, the complete Node/Bun/PostgreSQL codegen matrix, and the documentation build passed.
- Example tests: Simple 183 passed (one existing skip), SQLite Todo 60 passed, RSVP 72 passed, Local Guide 15 passed, and Semantic Notes 4 passed. Total: 334 passing tests.
- Four example typechecks passed. Simple's seven auth-test typing errors reproduce identically with the unmodified baseline runtime. They concern `SuperTest` versus `Agent` and are outside this change.
- All example image builds and codegen flows were exercised. Local codegen required installed Python 3.11 dependencies in place of an empty Pipenv environment. SQLite codegen passed with a fresh database and one consistent local runtime package. Verification-generated files and npm lockfile churn were restored to the initial revision.
- Review passes: 2 complete passes over the original implementation target and its repairs, with original PR interaction checks. No actionable findings remain in the reviewed scope.
- Repair rounds: 1 after full review. All four findings reproduced before repair: unfinished result privacy could permit an early commit; repeated custom counts accumulated source IDs; conditional wrappers hid privacy skips; draining pending reads could replace the original business error.
- Evidence: `review-pass1.md`, `review-pass1-repros.log`, `repair-round1.log`, `package-final.log`, `codegen-final.log`, `simple-types-baseline.log`, and the example logs in `/private/tmp/ent-scope-validation/`.

## Publication

These changes belong to [draft PR #2035](https://github.com/lolopinto/ent/pull/2035). The PR remains a draft.
