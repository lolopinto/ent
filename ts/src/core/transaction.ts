import DB, { Dialect, Queryer } from "./db";
import { log } from "./logger";
import {
  assertTransactionRead,
  createTransactionToken,
  failTransaction,
  getTransactionState,
  recordRowTransaction,
  trackValidationRead,
  runFinalScopeValidation,
  transactionStorage,
  TransactionState,
} from "./transaction_context";
import { assertValidationQuery } from "./transaction_validation";

export interface TransactionOptions {
  /**
   * Defaults to `serializable`. Conflicting decisions based on earlier reads
   * can abort the transaction and require a retry of the whole callback.
   * Use explicit locks to protect invariants with `read committed`.
   * Ordinary action transactions keep their configured isolation level.
   */
  isolationLevel?: "serializable" | "read committed";
  /**
   * Additional attempts for PostgreSQL serialization failures or deadlocks.
   * Defaults to 0.
   */
  maxRetries?: number;
}

export interface TransactionScope extends Queryer {
  readonly isolationLevel: "serializable" | "read committed";
  /** Zero-based attempt number. Rebuild actions and reload Ents on every attempt. */
  readonly attempt: number;
}

/** Uncached database reads on the transaction that owns final action validation. */
export interface ScopeValidationContext
  extends Pick<Queryer, "query" | "queryAll"> {
  readonly isolationLevel: "serializable" | "read committed";
  readonly attempt: number;
}

/** Inspect the current scope so a composed operation can join its caller. */
export function getTransactionScope(): TransactionScope | undefined {
  const state = getTransactionState();
  if (!state) {
    return undefined;
  }
  return {
    ...state.queryer,
    attempt: state.attempt,
    isolationLevel: state.isolationLevel,
  };
}

function retryable(error: unknown): boolean {
  const postgresError = error as { code?: string; errno?: string } | null;
  // Bun SQL exposes SQLSTATE in errno, while pg exposes it in code.
  const code =
    postgresError?.code === "ERR_POSTGRES_SERVER_ERROR"
      ? postgresError.errno
      : postgresError?.code;
  return code === "40001" || code === "40P01";
}

function dispose(state: TransactionState) {
  state.caches.clear();
  state.edgeMetadataLoader = undefined;
  state.receipts.length = 0;
  state.observers.length = 0;
  state.preparingRoot = undefined;
  state.preparingValidation = undefined;
  state.validators.clear();
  state.pendingActions.clear();
  state.pendingPreparations.clear();
}

/**
 * Include Ent loads, field defaults and transformations, privacy checks,
 * triggers, validators, and writes in one PostgreSQL transaction. Reject nested
 * scopes and prepare each top-level action after the preceding save. Run action
 * observers after commit and connection release, outside the scope.
 *
 * Await every operation. Construct actions, queries, and loaders inside the
 * callback. If the callback can be retried, keep external side effects outside it.
 */
export async function withTransactionScope<T>(
  callback: (scope: TransactionScope) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  if (getTransactionState()) {
    throw new Error("nested withTransactionScope is not supported");
  }
  // Serializable isolation protects decisions based on earlier reads.
  // This default applies only to withTransactionScope.
  const isolation = options.isolationLevel ?? "serializable";
  if (isolation !== "serializable" && isolation !== "read committed") {
    throw new Error(`unsupported transaction isolation level: ${isolation}`);
  }
  const maxRetries = options.maxRetries ?? 0;
  if (!Number.isSafeInteger(maxRetries) || maxRetries < 0) {
    throw new Error("maxRetries must be a non-negative safe integer");
  }
  const db = DB.getInstance();
  if (db.db.dialect !== Dialect.Postgres) {
    throw new Error(
      "withTransactionScope only supports PostgreSQL (pg or Bun SQL); SQLite is not supported",
    );
  }

  for (let attempt = 0; ; attempt++) {
    const client = await db.getNewClient();
    const scopedQuery =
      (
        invalidate: boolean,
        method: "query" | "exec" = "query",
      ): Queryer["query"] =>
      (sql, values) => {
        if (getTransactionState() !== state) {
          throw new Error(
            "transaction queryer cannot be used outside its callback",
          );
        }
        if (state.failed) {
          return Promise.reject(state.error);
        }
        if (state.validating) {
          try {
            assertValidationQuery(sql);
          } catch (error) {
            failTransaction(state, error);
            throw error;
          }
        }
        const read = { transaction: state, generation: state.generation };
        // Public SQL can write or acquire locks, so invalidate caches after it
        // completes. Framework reads preserve cached results.
        const pending = client[method](sql, values)
          .then((result) => {
            assertTransactionRead(read);
            const results = Array.isArray(result) ? result : [result];
            for (const statement of results) {
              for (const row of statement.rows) {
                recordRowTransaction(row, read);
              }
            }
            if (invalidate) {
              for (const cache of state.caches.values()) {
                cache.clearCache();
              }
              state.edgeMetadataLoader?.clearAll();
            }
            return result;
          })
          .catch((error) => {
            failTransaction(state, error);
            throw error;
          });
        state.pending.add(pending);
        // Register both handlers to avoid creating an unhandled rejection.
        void pending.then(
          () => state.pending.delete(pending),
          () => state.pending.delete(pending),
        );
        return trackValidationRead(pending);
      };
    const query = scopedQuery(true);
    const readQuery = scopedQuery(false);
    const state: TransactionState = {
      token: createTransactionToken(),
      isolationLevel: isolation,
      attempt,
      queryer: { query, queryAll: query, exec: scopedQuery(true, "exec") },
      readQueryer: { query: readQuery, queryAll: readQuery },
      active: true,
      failed: false,
      pending: new Set(),
      caches: new Map(),
      observers: [],
      receipts: [],
      generation: 0,
      validating: false,
      pendingActions: new Set(),
      pendingPreparations: new Set(),
      validators: new Map(),
    };
    let committed = false;
    let releaseError: Error | boolean | undefined;
    let result: T;
    let failure: unknown;
    let failed = false;
    try {
      await client.query(`BEGIN ISOLATION LEVEL ${isolation.toUpperCase()}`);
      result = await transactionStorage.run(state, async () => {
        const value = await callback({
          ...state.queryer,
          attempt,
          isolationLevel: isolation,
        });
        if (state.pendingActions.size || state.pendingPreparations.size) {
          failTransaction(
            state,
            new Error(
              "await each action save before leaving withTransactionScope",
            ),
          );
        }
        if (state.pending.size) {
          failTransaction(
            state,
            new Error("await all queries inside withTransactionScope"),
          );
        }
        if (state.failed) {
          throw state.error;
        }
        if (state.validators.size) {
          state.validating = true;
          state.generation++;
          state.edgeMetadataLoader = undefined;
          for (const cache of state.caches.values()) {
            cache.clearCache();
          }
          // Run deferred constraints and triggers while writes and row locks
          // are still allowed. Final checks must include their effects.
          await client.query("SET CONSTRAINTS ALL IMMEDIATE");
          // PostgreSQL permits switching to read-only after writes. Keep the
          // same connection so checks can see those uncommitted changes.
          await client.query("SET TRANSACTION READ ONLY");
          await client.query("SET LOCAL standard_conforming_strings = on");
          await runFinalScopeValidation(state, async () => {
            const context: ScopeValidationContext = Object.freeze({
              query: readQuery,
              queryAll: readQuery,
              attempt,
              isolationLevel: isolation,
            });
            for (const validate of state.validators.values()) {
              await validate(context);
              if (state.failed) {
                throw state.error;
              }
            }
          });
        }
        return value;
      });
      state.active = false;
      if (state.pending.size) {
        failTransaction(
          state,
          new Error("await all queries inside withTransactionScope"),
        );
        await Promise.allSettled([...state.pending]);
      }
      if (state.failed) {
        throw state.error;
      }
      await client.query("COMMIT");
      committed = true;
    } catch (error) {
      failed = true;
      failure = state.failed ? state.error : error;
      state.active = false;
      await Promise.allSettled([
        ...state.pending,
        ...state.pendingActions,
        ...state.pendingPreparations,
      ]);
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the original failure and discard the unusable connection.
        releaseError = true;
      }
    } finally {
      state.active = false;
      try {
        await client.release(releaseError);
      } catch (error) {
        releaseError = true;
        // Never retry a successful COMMIT because cleanup failed.
        log("error", error);
      }
    }
    if (failed) {
      dispose(state);
      if (!releaseError && retryable(failure) && attempt < maxRetries) {
        continue;
      }
      throw failure;
    }
    if (committed) {
      for (const receipt of state.receipts) {
        try {
          receipt();
        } catch (error) {
          log("error", error);
        }
      }
      // Clear participating request caches only after commit. Transaction rows
      // never enter these caches, so rollback leaves the caches unchanged.
      for (const cache of state.caches.keys()) {
        try {
          cache.clearCache();
        } catch (error) {
          log("error", error);
        }
      }
      for (const observe of state.observers) {
        try {
          await observe();
        } catch (error) {
          // Preserve existing observer behavior: a failure cannot undo
          // committed writes or cause the callback to retry.
          log("error", error);
        }
      }
    }
    dispose(state);
    return result!;
  }
}
