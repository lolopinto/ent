import { isPromise } from "util/types";
import {
  assertTransactionRead,
  getTransactionReadState,
  isFinalScopeValidation,
} from "./transaction_context";

export function memoizeNoArgs<T>(fn: () => T): () => T {
  let called = false;
  let value: T;

  return () => {
    if (called) {
      return value;
    }
    value = fn();
    called = true;
    return value;
  };
}

// Cached query and loader state cannot cross scopes. Observers and result
// callers can still read memoized builder fields after commit.
export function memoizeInTransaction<T>(fn: () => T): () => T {
  const transaction = getTransactionReadState();
  const memoized = memoizeNoArgs(fn);
  return () => {
    assertTransactionRead(transaction);
    const result = isFinalScopeValidation() ? fn() : memoized();
    if (transaction && isPromise(result)) {
      return result.then((value) => {
        assertTransactionRead(transaction);
        return value;
      }) as T;
    }
    return result;
  };
}
