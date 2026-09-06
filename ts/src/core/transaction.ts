import DB, { Dialect, Queryer } from "./db";
import { log } from "./logger";
import {
  assertTransactionRead,
  failTransaction,
  getTransactionState,
  recordRowTransaction,
  trackValidationRead,
  transactionStorage,
  TransactionState,
} from "./transaction_context";

export interface TransactionOptions {
  /** PostgreSQL only. Defaults to serializable. Read committed needs explicit locks. */
  isolationLevel?: "serializable" | "read committed";
  /** Additional attempts for PostgreSQL serialization failures/deadlocks. Default: 0. */
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
  if (!state) return undefined;
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
  state.resources.clear();
  state.receipts.length = 0;
  state.observers.length = 0;
  state.guardedRoot = undefined;
  state.branchClaims.length = 0;
}

/**
 * Include Ent loads, action preparation, validators, triggers and writes in one
 * PostgreSQL transaction. Nested scopes are rejected. Existing action Transaction
 * groups join this scope. Action observers run after commit, outside the scope.
 * Await every operation; construct actions, queries and loaders inside callback.
 * Retried callbacks must not perform external side effects.
 */
export async function withTransaction<T>(
  callback: (scope: TransactionScope) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  if (getTransactionState()) {
    throw new Error("nested withTransaction is not supported");
  }
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
    const state: TransactionState = {
      token: {},
      isolationLevel: isolation,
      attempt,
      queryer: undefined as unknown as Queryer,
      active: true,
      failed: false,
      pending: new Set(),
      caches: new Map(),
      resources: new Map(),
      observers: [],
      receipts: [],
      generation: 0,
      branchClaims: [],
    };
    const query: Queryer["query"] = (sql, values) => {
      if (getTransactionState() !== state) {
        throw new Error(
          "transaction queryer cannot be used outside its callback",
        );
      }
      if (state.failed) {
        return Promise.reject(state.error);
      }
      const read = { transaction: state, generation: state.generation };
      // Raw SQL may write or acquire a lock after an earlier cached read. Flush
      // every participating cache, including other viewers in this attempt.
      const pending = client
        .query(sql, values)
        .then((result) => {
          assertTransactionRead(read);
          for (const row of result.rows) recordRowTransaction(row, read);
          for (const cache of state.caches.values()) cache.clearCache();
          for (const resource of state.resources.values()) {
            (resource as { clearAll?(): void }).clearAll?.();
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
    state.queryer = { query, queryAll: query, exec: query };
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
        // A successful COMMIT must never be retried because cleanup failed.
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
      // Clear every participating request cache only after commit. Transaction
      // rows were never primed into them, and rollback leaves them untouched.
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
          // Match existing Ent observer semantics: observer failure cannot undo
          // committed writes or trigger callback retries.
          log("error", error);
        }
      }
    }
    dispose(state);
    return result!;
  }
}
