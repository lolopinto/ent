import DB, { Dialect, Queryer } from "./db";
import { log } from "./logger";
import {
  assertTransactionRead,
  createTransactionToken,
  failTransaction,
  getTransactionState,
  recordRowTransaction,
  trackValidationRead,
  transactionStorage,
  TransactionState,
} from "./transaction_context";

export interface TransactionOptions {
  /**
   * Defaults to `serializable` so conflicting read/validate/write decisions
   * can fail instead of violating an invariant. Only this opt-in API uses this
   * default; ordinary action transactions keep their configured isolation.
   * Serializable conflicts may require retrying the whole callback. Use
   * explicit locks to protect invariants with `read committed`.
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
  state.guardedRoot = undefined;
  state.branchClaims.length = 0;
}

/**
 * Include Ent loads, field defaults and transformations, privacy checks,
 * triggers, validators, and writes in one PostgreSQL transaction. Reject nested
 * scopes and let existing `Transaction` groups join this scope. Run action
 * observers after commit, outside the scope.
 * Await every operation. Construct actions, queries, and loaders inside the
 * callback. If the callback can be retried, keep external side effects outside it.
 */
export async function withTransaction<T>(
  callback: (scope: TransactionScope) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  if (getTransactionState()) {
    throw new Error("nested withTransaction is not supported");
  }
  // Serializable protects decisions based on earlier reads. This default is
  // local to the new scope and doesn't change ordinary action transactions.
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
      "withTransaction only supports PostgreSQL (pg or Bun SQL); SQLite is not supported",
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
        const read = { transaction: state, generation: state.generation };
        // Public SQL can write or acquire locks. Framework read loaders use a
        // separate path; their generated reads preserve other cached results.
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
      branchClaims: [],
    };
    let committed = false;
    let releaseError: Error | boolean | undefined;
    let result: T;
    let failure: unknown;
    let failed = false;
    try {
      await client.query(`BEGIN ISOLATION LEVEL ${isolation.toUpperCase()}`);
      result = await transactionStorage.run(state, () =>
        callback({ ...state.queryer, attempt, isolationLevel: isolation }),
      );
      state.active = false;
      if (state.pending.size) {
        failTransaction(
          state,
          new Error("await all queries inside withTransaction"),
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
      await Promise.allSettled([...state.pending]);
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the original failure and discard the unusable pg connection.
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
